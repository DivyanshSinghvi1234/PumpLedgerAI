"""Tests for Step 3: Daily & Monthly P&L and Tally Payment/Contra XML Export."""

from datetime import date
from decimal import Decimal

from app.core.enums import FuelType, IncomeKind, PaymentMode, PaymentStatus, VerificationStatus
from app.database.scoping import active_pump_id
from app.models.bank_account import BankAccount, BankTransaction
from app.models.fuel_tank import FuelTank, TankerDelivery
from app.models.income import Income
from app.models.pump import Pump
from app.models.voucher import Voucher
from app.services.report_service import ReportService
from app.services.tally_service import TallyService


def _ensure_pump(db_session) -> Pump:
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="PnL Pump", code="TST-PNL", address="Highway")
        db_session.add(pump)
        db_session.flush()
    return pump


def test_pnl_report_computes_fuel_margin_expenses_and_net_profit(db_session):
    pump = _ensure_pump(db_session)
    token = active_pump_id.set(pump.id)
    try:
        today = date.today()
        tank = FuelTank(
            name="Diesel Tank PNL",
            fuel_type=FuelType.DIESEL,
            capacity_liters=20000.0,
            pump_id=pump.id,
        )
        db_session.add(tank)
        db_session.flush()

        db_session.add(
            TankerDelivery(
                tank_id=tank.id,
                delivery_date=today,
                invoice_number="TNK-001",
                quantity_liters=5000.0,
                procurement_rate=85.0,
                pump_id=pump.id,
            )
        )
        db_session.add(
            Voucher(
                invoice_number="PNL-1",
                invoice_date=today,
                fuel_type=FuelType.DIESEL,
                quantity_liters=Decimal("100.00"),
                rate_per_liter=Decimal("90.00"),
                total_amount=Decimal("9000.00"),
                payment_mode=PaymentMode.CASH,
                payment_status=PaymentStatus.PAID,
                verification_status=VerificationStatus.VERIFIED,
                pump_id=pump.id,
            )
        )
        db_session.add(
            Income(
                kind=IncomeKind.EXPENSE,
                income_date=today,
                description="Paint and brushes",
                amount=Decimal("200.00"),
                category="Station Maintenance",
                payment_mode=PaymentMode.CASH,
                pump_id=pump.id,
            )
        )
        db_session.commit()

        pnl = ReportService().pnl_report(db_session, from_date=today, to_date=today)
        assert pnl.fuel_revenue >= Decimal("9000.00")
        assert pnl.total_expenses >= Decimal("200.00")
        assert any(c.category == "Station Maintenance" for c in pnl.expense_by_category)
    finally:
        active_pump_id.reset(token)


def test_tally_expenses_and_contra_xml_generation(db_session):
    pump = _ensure_pump(db_session)
    token = active_pump_id.set(pump.id)
    try:
        today = date.today()
        bank = BankAccount(
            account_name="HDFC Current",
            bank_name="HDFC",
            account_number="5020001234",
            account_type="CURRENT",
            opening_balance=Decimal("0.00"),
            current_balance=Decimal("5000.00"),
            pump_id=pump.id,
        )
        db_session.add(bank)
        db_session.flush()

        db_session.add(
            BankTransaction(
                bank_account_id=bank.id,
                transaction_type="DEPOSIT",
                amount=Decimal("5000.00"),
                transaction_date=today,
                remarks="Cash deposit",
                pump_id=pump.id,
            )
        )
        db_session.add(
            Income(
                kind=IncomeKind.EXPENSE,
                income_date=today,
                description="Office furniture",
                amount=Decimal("1200.00"),
                category="Furniture",
                payment_mode=PaymentMode.CASH,
                pump_id=pump.id,
            )
        )
        db_session.commit()

        xml = TallyService().generate_expenses_and_contra_xml(db_session, today, today)
        assert "<VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>" in xml
        assert "<VOUCHERTYPENAME>Contra</VOUCHERTYPENAME>" in xml
        assert "HDFC Current" in xml
        assert "Furniture" in xml
    finally:
        active_pump_id.reset(token)
