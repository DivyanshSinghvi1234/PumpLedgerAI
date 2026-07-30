import pytest
from datetime import date
from decimal import Decimal
from app.models.pump import Pump
from app.schemas.bank_account import BankAccountCreate, CashDepositRequest
from app.services.bank_account_service import BankAccountService
from app.core.enums import PaymentMode


def test_bank_account_creation_and_cash_deposit(db_session):
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Bank Pump", code="TST-BNK", address="Test Address")
        db_session.add(pump)
        db_session.flush()

    service = BankAccountService()

    # 1. Create ICICI Bank Account with ₹50,000 opening balance
    bank_create = BankAccountCreate(
        account_name="ICICI Current Account",
        bank_name="ICICI Bank",
        account_number="9180100998822",
        ifsc_code="ICIC0001234",
        account_type="CURRENT",
        opening_balance=Decimal("50000.00"),
    )

    account = service.create_bank_account(db_session, bank_create, pump_id=pump.id)
    assert account is not None
    assert account.current_balance == Decimal("50000.00")
    assert account.bank_name == "ICICI Bank"

    # 2. Perform Cash-to-Bank Deposit of ₹25,000
    deposit_req = CashDepositRequest(
        bank_account_uuid=account.uuid,
        amount=Decimal("25000.00"),
        deposit_date=date.today(),
        reference_number="SLIP-10293",
        remarks="End of day forecourt cash deposit",
    )

    txn = service.deposit_cash_to_bank(db_session, deposit_req, pump_id=pump.id)
    assert txn is not None
    assert txn.transaction_type == "DEPOSIT"
    assert account.current_balance == Decimal("75000.00")

    # 3. Retrieve Liquid Funds Summary
    summary = service.get_liquid_funds_summary(db_session, pump_id=pump.id)
    assert summary["total_bank_balance"] >= Decimal("75000.00")
    assert len(summary["accounts"]) >= 1
