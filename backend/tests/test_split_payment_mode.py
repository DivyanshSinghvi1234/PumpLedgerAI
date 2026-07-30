import pytest
from decimal import Decimal
from datetime import date
from pydantic import ValidationError

from app.core.enums import LedgerEntryType, PaymentMode, PaymentStatus
from app.schemas.voucher import VoucherCreate
from app.services.voucher_service import VoucherService
from app.models.customer import Customer
from app.models.ledger_entry import LedgerEntry


def test_split_payment_mode_schema_validation():
    # Valid split payment: total 800 = 500 cash + 300 upi
    valid_payload = VoucherCreate(
        invoice_number="INV-SPLIT-001",
        invoice_date=date(2026, 7, 30),
        fuel_type="PETROL",
        quantity_liters=Decimal("8.000"),
        rate_per_liter=Decimal("100.00"),
        total_amount=Decimal("800.00"),
        payment_mode=PaymentMode.SPLIT,
        cash_amount=Decimal("500.00"),
        upi_amount=Decimal("300.00"),
        card_amount=Decimal("0.00"),
        credit_amount=Decimal("0.00"),
    )
    assert valid_payload.payment_mode == PaymentMode.SPLIT
    assert valid_payload.cash_amount == Decimal("500.00")

    # Invalid split payment sum (500 cash + 200 upi = 700 != 800 total)
    with pytest.raises(ValidationError) as exc_info:
        VoucherCreate(
            invoice_number="INV-SPLIT-002",
            invoice_date=date(2026, 7, 30),
            fuel_type="PETROL",
            quantity_liters=Decimal("8.000"),
            rate_per_liter=Decimal("100.00"),
            total_amount=Decimal("800.00"),
            payment_mode=PaymentMode.SPLIT,
            cash_amount=Decimal("500.00"),
            upi_amount=Decimal("200.00"),
            card_amount=Decimal("0.00"),
            credit_amount=Decimal("0.00"),
        )
    assert "sum of split amounts" in str(exc_info.value)


def test_split_payment_voucher_service_creation(db_session):
    service = VoucherService()
    
    # Ensure pump exists
    from app.models.pump import Pump
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Default Station", code="PUMP01")
        db_session.add(pump)
        db_session.flush()

    # Create customer
    customer = Customer(name="Test Split Customer", customer_code="CUST-SPLIT-01", pump_id=pump.id)
    db_session.add(customer)
    db_session.flush()

    # Split voucher with 500 Cash + 300 UPI (total 800 -> fully paid)
    voucher_data = VoucherCreate(
        invoice_number="INV-SPLIT-100",
        invoice_date=date(2026, 7, 30),
        customer_name=customer.name,
        customer_uuid=customer.uuid,
        fuel_type="PETROL",
        quantity_liters=Decimal("8.000"),
        rate_per_liter=Decimal("100.00"),
        total_amount=Decimal("800.00"),
        payment_mode=PaymentMode.SPLIT,
        cash_amount=Decimal("500.00"),
        upi_amount=Decimal("300.00"),
        card_amount=Decimal("0.00"),
        credit_amount=Decimal("0.00"),
    )

    voucher = service.create(db_session, voucher_data)
    assert voucher.payment_mode == PaymentMode.SPLIT
    assert voucher.amount_paid == Decimal("800.00")
    assert voucher.payment_status == PaymentStatus.PAID

    # Verify ledger entries (1 debit for sale, 2 credits for Cash & UPI)
    entries = db_session.query(LedgerEntry).filter(LedgerEntry.customer_id == customer.id).all()
    assert len(entries) == 3
    
    debit_entry = [e for e in entries if e.entry_type == LedgerEntryType.VOUCHER][0]
    assert debit_entry.amount == Decimal("800.00")

    credits = [e for e in entries if e.entry_type == LedgerEntryType.PAYMENT]
    assert len(credits) == 2
    credit_amounts = sorted([c.amount for c in credits])
    assert credit_amounts == [Decimal("300.00"), Decimal("500.00")]


