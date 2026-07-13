from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums import (
    FuelType,
    PaymentMode,
    VerificationStatus,
)


# =====================================================
# Daily Sales
# =====================================================

class DailyReportResponse(BaseModel):

    report_date: date

    total_sales: Decimal

    total_vouchers: int

    petrol_sales: Decimal

    diesel_sales: Decimal

    cash_sales: Decimal

    upi_sales: Decimal

    credit_sales: Decimal

    average_invoice: Decimal


# =====================================================
# Voucher Report
# =====================================================

class VoucherReportRow(BaseModel):

    invoice_number: str
    invoice_date: date

    customer_name: str | None = None
    vehicle_number: str | None = None

    fuel_type: FuelType

    quantity_liters: Decimal
    rate_per_liter: Decimal
    total_amount: Decimal

    payment_mode: PaymentMode
    verification_status: VerificationStatus

    model_config = ConfigDict(from_attributes=True)


class VoucherReportResponse(BaseModel):

    rows: list[VoucherReportRow]

    total_amount: Decimal
    total_quantity: Decimal
    count: int


# =====================================================
# Customer Report
# =====================================================

class CustomerReportRow(BaseModel):

    customer_code: str | None = None
    name: str
    mobile: str | None = None
    gst_number: str | None = None

    credit_limit: Decimal
    outstanding_balance: Decimal

    model_config = ConfigDict(from_attributes=True)


class CustomerReportResponse(BaseModel):

    rows: list[CustomerReportRow]

    total_outstanding: Decimal
    count: int


# =====================================================
# Ledger Report (per-customer statement, date-filtered)
# =====================================================

class LedgerReportRow(BaseModel):

    entry_type: str
    amount: Decimal
    signed_amount: Decimal
    balance_after: Decimal
    entry_date: date
    reference_type: str | None = None
    remarks: str | None = None


class LedgerReportResponse(BaseModel):

    customer_uuid: UUID
    customer_name: str

    from_date: date | None = None
    to_date: date | None = None

    opening_balance: Decimal
    closing_balance: Decimal

    rows: list[LedgerReportRow]
    count: int
