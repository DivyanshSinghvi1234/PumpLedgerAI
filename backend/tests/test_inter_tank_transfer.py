import pytest
from datetime import date
from app.models.pump import Pump
from app.models.fuel_tank import FuelTank
from app.services.fuel_tank_service import FuelTankService
from app.core.enums import FuelType


def test_inter_tank_transfer_success_and_revert(db_session):
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Pump Transfer", code="TST-TR", address="Test Address")
        db_session.add(pump)
        db_session.flush()

    tank_src = FuelTank(
        name="Tank 1 Petrol",
        fuel_type=FuelType.PETROL,
        capacity_liters=20000.0,
        current_stock_liters=15000.0,
        pump_id=pump.id,
    )
    tank_dst = FuelTank(
        name="Tank 2 Petrol",
        fuel_type=FuelType.PETROL,
        capacity_liters=10000.0,
        current_stock_liters=2000.0,
        pump_id=pump.id,
    )
    db_session.add_all([tank_src, tank_dst])
    db_session.flush()

    service = FuelTankService()

    # 1. Execute valid transfer of 3,000L from Tank 1 -> Tank 2
    transfer = service.create_tank_transfer(
        db=db_session,
        source_tank_uuid=tank_src.uuid,
        destination_tank_uuid=tank_dst.uuid,
        transfer_date=date(2026, 7, 30),
        quantity_liters=3000.0,
        reason="Tank Cleaning & Decanting",
        remarks="Decanted before maintenance",
    )

    assert transfer is not None
    assert transfer.quantity_liters == 3000.0
    assert transfer.reason == "Tank Cleaning & Decanting"

    db_session.refresh(tank_src)
    db_session.refresh(tank_dst)

    # Tank 1: 15,000 - 3,000 = 12,000L
    assert tank_src.current_stock_liters == 12000.0
    # Tank 2: 2,000 + 3,000 = 5,000L
    assert tank_dst.current_stock_liters == 5000.0

    # 2. List transfers
    transfers_list = service.list_tank_transfers(db_session)
    assert len(transfers_list) >= 1
    item = next(t for t in transfers_list if t["uuid"] == transfer.uuid)
    assert item["source_tank_name"] == "Tank 1 Petrol"
    assert item["destination_tank_name"] == "Tank 2 Petrol"

    # 3. Revert transfer
    service.delete_tank_transfer(db_session, transfer.uuid)
    db_session.refresh(tank_src)
    db_session.refresh(tank_dst)

    # Reverted stocks: Tank 1 -> 15,000L, Tank 2 -> 2,000L
    assert tank_src.current_stock_liters == 15000.0
    assert tank_dst.current_stock_liters == 2000.0


def test_inter_tank_transfer_insufficient_stock(db_session):
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Pump Transfer 2", code="TST-TR2", address="Test Address")
        db_session.add(pump)
        db_session.flush()

    tank_src = FuelTank(
        name="Tank Low Stock",
        fuel_type=FuelType.DIESEL,
        capacity_liters=10000.0,
        current_stock_liters=500.0,
        pump_id=pump.id,
    )
    tank_dst = FuelTank(
        name="Tank Destination",
        fuel_type=FuelType.DIESEL,
        capacity_liters=10000.0,
        current_stock_liters=1000.0,
        pump_id=pump.id,
    )
    db_session.add_all([tank_src, tank_dst])
    db_session.flush()

    service = FuelTankService()

    # Attempt to transfer 1,000L when stock is only 500L -> raise ValueError
    with pytest.raises(ValueError, match="Insufficient stock"):
        service.create_tank_transfer(
            db=db_session,
            source_tank_uuid=tank_src.uuid,
            destination_tank_uuid=tank_dst.uuid,
            transfer_date=date(2026, 7, 30),
            quantity_liters=1000.0,
            reason="Bay Stock Balancing",
        )
