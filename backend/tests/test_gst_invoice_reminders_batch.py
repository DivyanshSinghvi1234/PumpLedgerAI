"""Tests for Consolidated Monthly GST Invoice, Bulk Overdue WhatsApp Reminders,
and Batch Multi-Slip OCR Upload."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from app.core.enums import FuelType, PaymentMode, PaymentStatus, VerificationStatus
from app.models.customer import Customer
from app.models.pump import Pump
from app.models.voucher import Voucher
from app.schemas.review import ReviewResponse, ValidationResult
from app.schemas.vision import OCRResult
from app.services.report_service import ReportService
from app.services.whatsapp_digest_service import WhatsAppDigestService


def _ensure_pump(db_session) -> Pump:
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Pump", code="TST-01", address="Main Road")
        db_session.add(pump)
        db_session.flush()
    return pump


def test_monthly_gst_invoice_groups_by_hsn_and_vehicle(db_session):
    pump = _ensure_pump(db_session)
    customer = Customer(
        name="Apex Fleet Pvt Ltd",
        customer_code="APEX01",
        gst_number="27AABCU9603R1ZM",
        mobile="9876543210",
        pump_id=pump.id,
    )
    db_session.add(customer)
    db_session.flush()

    today = date.today()
    month_str = f"{today.year:04d}-{today.month:02d}"

    v1 = Voucher(
        invoice_number="SLIP-1",
        invoice_date=today,
        customer_id=customer.id,
        customer_name=customer.name,
        vehicle_number="MH12AB1111",
        fuel_type=FuelType.DIESEL,
        quantity_liters=Decimal("50.00"),
        rate_per_liter=Decimal("90.00"),
        total_amount=Decimal("4500.00"),
        payment_mode=PaymentMode.CREDIT,
        payment_status=PaymentStatus.UNPAID,
        verification_status=VerificationStatus.VERIFIED,
        pump_id=pump.id,
    )
    v2 = Voucher(
        invoice_number="SLIP-2",
        invoice_date=today,
        customer_id=customer.id,
        customer_name=customer.name,
        vehicle_number="MH12AB2222",
        fuel_type=FuelType.PETROL,
        quantity_liters=Decimal("20.00"),
        rate_per_liter=Decimal("100.00"),
        total_amount=Decimal("2000.00"),
        payment_mode=PaymentMode.CREDIT,
        payment_status=PaymentStatus.UNPAID,
        verification_status=VerificationStatus.VERIFIED,
        pump_id=pump.id,
    )
    db_session.add_all([v1, v2])
    db_session.flush()

    res = ReportService().monthly_gst_invoice(
        db_session, str(customer.uuid), billing_month=month_str
    )

    assert res.invoice_number == f"GST-{today.year:04d}{today.month:02d}-APEX01"
    assert res.slip_count == 2
    assert res.total_liters == Decimal("70.00")
    assert res.grand_total == Decimal("6500.00")
    hsn_codes = {row.fuel_type: row.hsn_code for row in res.hsn_summary}
    assert hsn_codes["DIESEL"] == "27101944"
    assert hsn_codes["PETROL"] == "27101241"
    assert len(res.vehicle_subtotals) == 2


def test_whatsapp_overdue_reminders_filters_by_age(db_session):
    pump = _ensure_pump(db_session)
    customer = Customer(
        name="Overdue Haulage",
        mobile="9988776655",
        pump_id=pump.id,
    )
    db_session.add(customer)
    db_session.flush()

    old_date = date.today() - timedelta(days=25)
    v = Voucher(
        invoice_number="OLD-01",
        invoice_date=old_date,
        customer_id=customer.id,
        customer_name=customer.name,
        fuel_type=FuelType.DIESEL,
        quantity_liters=Decimal("10.00"),
        rate_per_liter=Decimal("90.00"),
        total_amount=Decimal("900.00"),
        payment_mode=PaymentMode.CREDIT,
        payment_status=PaymentStatus.UNPAID,
        verification_status=VerificationStatus.VERIFIED,
        pump_id=pump.id,
    )
    db_session.add(v)
    db_session.flush()

    reminders = WhatsAppDigestService().get_overdue_reminders(
        db_session, min_age_days=15
    )

    assert reminders["total_customers"] >= 1
    match = next(i for i in reminders["items"] if i["customer_name"] == "Overdue Haulage")
    assert match["overdue_amount"] == 900.0
    assert match["max_age_days"] >= 25
    assert match["whatsapp_url"].startswith("https://wa.me/919988776655?text=")


def test_batch_upload_endpoint_handles_multiple_files(client):
    from app.core.dependencies import get_current_user
    from app.core.enums import UserRole
    from app.main import app
    from app.models.user import User

    fake_user = User(
        id=999,
        username="batch_tester",
        full_name="Batch Tester",
        role=UserRole.ADMIN,
        is_active=True,
    )

    fake_review = ReviewResponse(
        ocr=OCRResult(
            provider="GEMINI",
            confidence=0.95,
            invoice_number="BATCH-1",
            total_amount=Decimal("500.00"),
            image_path="storage/invoices/test.jpg",
        ),
        validation=ValidationResult(warnings=[], errors=[]),
        ready_to_save=True,
    )

    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with patch(
            "app.api.v1.routes.upload.service.upload_image",
            new=AsyncMock(return_value=fake_review),
        ):
            resp = client.post(
                "/api/v1/uploads/batch",
                files=[
                    ("files", ("slip1.jpg", b"img1", "image/jpeg")),
                    ("files", ("slip2.jpg", b"img2", "image/jpeg")),
                ],
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 201
    body = resp.json()
    assert body["total"] == 2
    assert body["succeeded"] == 2
    assert body["failed"] == 0
    assert len(body["results"]) == 2
