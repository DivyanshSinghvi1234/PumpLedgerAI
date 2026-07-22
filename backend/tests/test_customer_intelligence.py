from datetime import date, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest

from app.core.enums import FuelType, PaymentMode
from app.models.customer import Customer
from app.models.voucher import Voucher
from app.models.nps_rating import NPSRating
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


def test_churn_analytics(H, client: TestClient, db_session: Session):
    pump = db_session.scalar(
        __import__("sqlalchemy").select(Pump).where(Pump.uuid == H["X-Pump-UUID"])
    )
    assert pump is not None

    # Clear existing active customers and vouchers
    db_session.execute(
        __import__("sqlalchemy").delete(Voucher).where(Voucher.pump_id == pump.id)
    )
    db_session.execute(
        __import__("sqlalchemy").delete(Customer).where(Customer.pump_id == pump.id)
    )
    db_session.commit()

    # Create 3 customers
    cust_a = Customer(name="Customer A", customer_code="CA0001", pump_id=pump.id)
    cust_b = Customer(name="Customer B", customer_code="CA0002", pump_id=pump.id)
    cust_c = Customer(name="Customer C", customer_code="CA0003", pump_id=pump.id)
    db_session.add_all([cust_a, cust_b, cust_c])
    db_session.commit()

    today = date.today()

    # Customer A: Champions (recency <= 15, frequency >= 5)
    for i in range(5):
        db_session.add(
            Voucher(
                invoice_number=f"INV-A-{i}",
                invoice_date=today - timedelta(days=2),
                customer_id=cust_a.id,
                fuel_type=FuelType.DIESEL,
                quantity_liters=Decimal("20.0"),
                total_amount=Decimal("1800.00"),
                payment_mode=PaymentMode.CREDIT,
                pump_id=pump.id,
            )
        )

    # Customer B: At Risk (recency > 30 and recency <= 90)
    db_session.add(
        Voucher(
            invoice_number="INV-B-1",
            invoice_date=today - timedelta(days=45),
            customer_id=cust_b.id,
            fuel_type=FuelType.DIESEL,
            quantity_liters=Decimal("50.0"),
            total_amount=Decimal("4500.00"),
            payment_mode=PaymentMode.CREDIT,
            pump_id=pump.id,
        )
    )

    # Customer C: Hibernating (frequency == 0 or recency > 90)
    # Customer C has no vouchers

    db_session.commit()

    response = client.get("/api/v1/analytics/churn", headers=H)
    assert response.status_code == 200

    data = response.json()
    assert data["segments"]["Champions"] == 1
    assert data["segments"]["At Risk"] == 1
    assert data["segments"]["Hibernating"] == 1
    assert data["segments"]["Loyal"] == 0

    customers_list = data["customers"]
    assert len(customers_list) == 3


def test_nps_rating_and_analytics(H, client: TestClient, db_session: Session):
    pump = db_session.scalar(
        __import__("sqlalchemy").select(Pump).where(Pump.uuid == H["X-Pump-UUID"])
    )
    assert pump is not None

    db_session.execute(
        __import__("sqlalchemy").delete(NPSRating).where(NPSRating.pump_id == pump.id)
    )
    db_session.commit()

    # 1. Generate token (Protected)
    resp = client.post(
        "/api/v1/nps/generate",
        json={"customer_phone": "+919876543210"},
        headers=H,
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    assert token.startswith("nps-")

    # 2. Submit rating (Public - No headers)
    rate_resp = client.post(
        f"/api/v1/nps/rate/{token}",
        json={"rating": 5, "feedback": "Great service!"},
    )
    assert rate_resp.status_code == 200
    assert rate_resp.json()["message"] == "Thank you for your feedback!"

    # 3. Generate another token and rate it 1 star (detractor)
    resp2 = client.post(
        "/api/v1/nps/generate",
        json={"customer_phone": "+919876543211"},
        headers=H,
    )
    token2 = resp2.json()["token"]
    rate_resp2 = client.post(
        f"/api/v1/nps/rate/{token2}",
        json={"rating": 1, "feedback": "Fuel delivery was slow"},
    )
    assert rate_resp2.status_code == 200

    # 4. Fetch analytics (Protected)
    analytics_resp = client.get("/api/v1/nps/analytics", headers=H)
    assert analytics_resp.status_code == 200

    data = analytics_resp.json()
    assert data["total_ratings"] == 2
    # 1 Promoter (5 stars) and 1 Detractor (1 star)
    # NPS = (1 - 1) / 2 * 100 = 0.0
    assert data["nps_score"] == 0.0
    assert data["average_rating"] == 3.0
    assert data["rating_distribution"]["5"] == 1
    assert data["rating_distribution"]["1"] == 1

    feedbacks = data["feedbacks"]
    assert len(feedbacks) == 2
    assert feedbacks[0]["feedback"] == "Fuel delivery was slow"
    assert feedbacks[1]["feedback"] == "Great service!"
