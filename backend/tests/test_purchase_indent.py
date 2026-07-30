import pytest
from datetime import date
from app.models.pump import Pump
from app.models.fuel_tank import FuelTank
from app.models.purchase_indent import OMCCompany, IndentStatus
from app.services.purchase_indent_service import PurchaseIndentService
from app.core.enums import FuelType


def test_purchase_indent_lifecycle_and_auto_decant(db_session):
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Indent Pump", code="TST-IND", address="Test Address")
        db_session.add(pump)
        db_session.flush()

    tank = FuelTank(
        name="Tank Petrol Indent",
        fuel_type=FuelType.PETROL,
        capacity_liters=25000.0,
        current_stock_liters=5000.0,
        pump_id=pump.id,
    )
    db_session.add(tank)
    db_session.flush()

    service = PurchaseIndentService()

    # 1. Create Purchase Indent
    indent = service.create_indent(
        db=db_session,
        omc_company=OMCCompany.IOCL,
        terminal_name="Koyali Terminal",
        fuel_type=FuelType.PETROL,
        ordered_liters=12000.0,
        expected_delivery_date=date(2026, 7, 30),
        procurement_cost_per_liter=88.5,
        remarks="Holiday peak stock balance",
    )

    assert indent is not None
    assert indent.status == IndentStatus.INDENTED
    assert indent.ordered_liters == 12000.0
    assert indent.indent_number.startswith("IND-")

    # 2. Dispatch Indent with Tank Truck Vehicle
    updated_disp = service.update_indent_status(
        db=db_session,
        indent_uuid=indent.uuid,
        status=IndentStatus.DISPATCHED,
        tank_truck_number="GJ-12-AX-8910",
    )
    assert updated_disp.status == IndentStatus.DISPATCHED
    assert updated_disp.tank_truck_number == "GJ-12-AX-8910"

    # 3. Deliver Indent & Auto-Decant into Storage Tank
    initial_stock = tank.current_stock_liters  # 5,000L
    updated_deliv = service.update_indent_status(
        db=db_session,
        indent_uuid=indent.uuid,
        status=IndentStatus.DELIVERED,
        actual_delivery_date=date(2026, 7, 30),
        decanted_tank_uuid=tank.uuid,
        density_at_15c=745.2,
        invoice_number="INV-IOCL-9988",
        total_invoice_amount=1062000.0,
    )

    assert updated_deliv.status == IndentStatus.DELIVERED
    assert updated_deliv.density_at_15c == 745.2

    db_session.refresh(tank)
    # Tank stock auto-increased: 5,000 + 12,000 = 17,000 L
    assert tank.current_stock_liters == initial_stock + 12000.0
