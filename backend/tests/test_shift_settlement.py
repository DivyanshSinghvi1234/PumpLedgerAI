"""Tests for Step 2: 8 PM Shift Settlement, 6 AM Price Split, Float Handover,
OMC Fleet Card, Digital Bank Settlement, and Staff Shortage Posting."""

from datetime import date
from decimal import Decimal

from app.database.scoping import active_pump_id
from app.models.bank_account import BankAccount
from app.models.employee import Employee
from app.models.pump import Pump
from app.schemas.shift import SettlementNozzleLine, ShiftSettlementCreate
from app.services.employee_service import EmployeeService
from app.services.shift_service import ShiftService


def _ensure_pump(db_session) -> Pump:
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Settlement Pump", code="TST-SET", address="Main Road")
        db_session.add(pump)
        db_session.flush()
    return pump


def test_shift_settlement_with_6am_price_split_and_shortage_posting(db_session):
    pump = _ensure_pump(db_session)
    token = active_pump_id.set(pump.id)
    try:
        emp = Employee(
            full_name="Vijay Night Shift",
            role="OPERATOR",
            base_salary=Decimal("16000.00"),
            pump_id=pump.id,
        )
        db_session.add(emp)
        db_session.commit()
        db_session.refresh(emp)

        service = ShiftService()
        # Night shift crossing 6:00 AM price change:
        # 100L @ 90.00 (9000) + 50L @ 92.00 (4600) = 13600.00 gross
        settlement = service.create_settlement(
            db_session,
            ShiftSettlementCreate(
                settlement_date=date.today(),
                shift_label="NIGHT_SHIFT",
                attendant_names="Vijay, Manoj",
                responsible_employee_uuid=str(emp.uuid),
                opening_float=Decimal("2000.00"),
                nozzle_lines=[
                    SettlementNozzleLine(
                        nozzle_name="N1 Diesel",
                        fuel_type="DIESEL",
                        opening_reading=1000.0,
                        interim_6am_reading=1100.0,
                        closing_reading=1155.0,
                        testing_liters=5.0,
                        old_rate=Decimal("90.00"),
                        new_rate=Decimal("92.00"),
                    )
                ],
                credit_sales_total=Decimal("3000.00"),
                upi_total=Decimal("2500.00"),
                card_edc_total=Decimal("2000.00"),
                omc_fleet_card_total=Decimal("1000.00"),
                mdr_fee_percent=Decimal("1.00"),
                expenses_cash_total=Decimal("500.00"),
                cash_handed_to_next_shift=Decimal("1500.00"),
                # Expected cash = 2000 + 13600 - 3000 - 2500 - 2000 - 1000 - 500 - 1500 = 5100.00
                # Counted cash = 10*500 = 5000.00 => Variance = -100.00 shortage
                notes_500=10,
                charge_shortage_to_staff=True,
            ),
        )

        assert settlement.gross_meter_sales == Decimal("13600.00")
        assert settlement.expected_cash_in_hand == Decimal("5100.00")
        assert settlement.actual_cash_counted == Decimal("5000.00")
        assert settlement.variance == Decimal("-100.00")
        assert settlement.digital_settlement_status == "PENDING"

        # Auto-linked float for next shift
        defaults = service.get_settlement_defaults(db_session, date.today())
        assert defaults.previous_handover_float == Decimal("1500.00")

        # Shortage posted to employee ledger
        ledger = EmployeeService().get_ledger(db_session, str(emp.uuid))
        assert ledger.outstanding_balance == Decimal("100.00")
        assert ledger.entries[0].entry_type == "SHORTAGE"

        # Settle digital batch to bank (UPI 2500 + Card 2000 - 1% MDR on Card (20) = 4480)
        bank = BankAccount(
            account_name="SBI Current",
            bank_name="SBI",
            account_number="1234567890",
            account_type="CURRENT",
            opening_balance=Decimal("10000.00"),
            current_balance=Decimal("10000.00"),
            pump_id=pump.id,
        )
        db_session.add(bank)
        db_session.commit()
        db_session.refresh(bank)

        settled = service.settle_digital(
            db_session,
            settlement_uuid=str(settlement.uuid),
            bank_account_uuid=str(bank.uuid),
            settled_date=date.today(),
        )
        db_session.refresh(bank)
        assert settled.digital_settlement_status == "SETTLED"
        assert bank.current_balance == Decimal("14480.00")
    finally:
        active_pump_id.reset(token)
