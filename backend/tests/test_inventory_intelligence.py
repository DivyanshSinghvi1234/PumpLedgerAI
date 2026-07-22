from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest

from app.core.enums import FuelType, PaymentMode
from app.models.fuel_tank import FuelTank, TankerDelivery
from app.models.price_schedule import PriceSchedule
from app.models.voucher import Voucher
from app.models.pump import Pump


@pytest.fixture
def H(client):
    r = client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    pumps = client.get(
        "/api/v1/pumps", headers={"Authorization": f"Bearer {token}"}
    ).json()
    headers = {"Authorization": f"Bearer {token}"}
    if pumps:
        headers["X-Pump-UUID"] = pumps[0]["uuid"]
    return headers


def test_fuel_tank_forecast(H, client: TestClient, db_session: Session):
    # 1. Retrieve the active test pump matching H
    pump = db_session.scalar(
        __import__("sqlalchemy").select(Pump).where(Pump.uuid == H["X-Pump-UUID"])
    )
    assert pump is not None

    # Clear existing active tanks and vouchers under this pump
    db_session.execute(
        __import__("sqlalchemy").delete(FuelTank).where(FuelTank.pump_id == pump.id)
    )
    db_session.execute(
        __import__("sqlalchemy").delete(Voucher).where(Voucher.pump_id == pump.id)
    )
    db_session.commit()

    # 2. Create an active fuel tank scoped to the pump
    tank = FuelTank(
        name="Diesel Tank A",
        fuel_type=FuelType.DIESEL,
        capacity_liters=10000.0,
        current_stock_liters=5000.0,
        pump_id=pump.id,
    )
    db_session.add(tank)
    db_session.commit()

    # 3. Create vouchers for DIESEL in the past 7 days scoped to the pump
    today = date.today()
    for i in range(7):
        voucher = Voucher(
            invoice_number=f"INV-TEST-{i}",
            invoice_date=today - timedelta(days=i),
            fuel_type=FuelType.DIESEL,
            quantity_liters=Decimal("20.000"),
            total_amount=Decimal("1800.00"),
            payment_mode=PaymentMode.CASH,
            pump_id=pump.id,
        )
        db_session.add(voucher)
    db_session.commit()

    # 4. Request the forecast endpoint
    response = client.get("/api/v1/fuel-tanks/forecast", headers=H)
    assert response.status_code == 200

    data = response.json()
    assert len(data) >= 1

    forecast = next(f for f in data if f["tank_uuid"] == tank.uuid)
    assert forecast["fuel_type"] == "DIESEL"
    assert forecast["current_stock_liters"] == 5000.0
    assert forecast["avg_daily_sales"] == 20.0
    # days_until_empty = current_stock / avg_daily_sales = 5000 / 20 = 250.0
    assert forecast["days_until_empty"] == 250.0


def test_daily_profit_margins(H, client: TestClient, db_session: Session):
    pump = db_session.scalar(
        __import__("sqlalchemy").select(Pump).where(Pump.uuid == H["X-Pump-UUID"])
    )
    assert pump is not None

    db_session.execute(
        __import__("sqlalchemy").delete(PriceSchedule).where(PriceSchedule.pump_id == pump.id)
    )
    db_session.execute(
        __import__("sqlalchemy").delete(TankerDelivery).where(TankerDelivery.pump_id == pump.id)
    )
    db_session.commit()

    # 1. Create a Diesel tank scoped to the pump
    tank = db_session.scalar(
        __import__("sqlalchemy")
        .select(FuelTank)
        .where(FuelTank.fuel_type == FuelType.DIESEL, FuelTank.pump_id == pump.id)
        .limit(1)
    )
    if not tank:
        tank = FuelTank(
            name="Diesel Tank A",
            fuel_type=FuelType.DIESEL,
            capacity_liters=10000.0,
            current_stock_liters=5000.0,
            pump_id=pump.id,
        )
        db_session.add(tank)
        db_session.commit()

    today = date.today()

    # 2. Create PriceSchedule for DIESEL scoped to the pump
    schedule = PriceSchedule(
        fuel_type=FuelType.DIESEL,
        rate=Decimal("90.00"),
        effective_from=datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=timezone.utc),
        is_applied=True,
        pump_id=pump.id,
    )
    db_session.add(schedule)

    # 3. Create TankerDelivery for DIESEL with procurement rate scoped to the pump
    delivery = TankerDelivery(
        tank_id=tank.id,
        delivery_date=today - timedelta(days=2),
        invoice_number="INV-DEL-1",
        quantity_liters=1000.0,
        procurement_rate=80.00,
        pump_id=pump.id,
    )
    db_session.add(delivery)
    db_session.commit()

    # 4. Request the margins endpoint
    response = client.get("/api/v1/analytics/margins", headers=H)
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 30

    # Today should have DIESEL margin = 90.00 - 80.00 = 10.0
    today_entry = data[-1]
    assert today_entry["date"] == today.isoformat()
    assert today_entry["DIESEL"] == 10.0
