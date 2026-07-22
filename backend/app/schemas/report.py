from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums import (
    FuelType,
    PaymentMode,
    PaymentStatus,
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
    payment_status: PaymentStatus = PaymentStatus.UNPAID
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


# =====================================================
# Debtor Aging Report
# =====================================================

class DebtorAgingRow(BaseModel):

    customer_uuid: str
    customer_name: str
    mobile: str | None = None

    total_outstanding: Decimal

    # Open invoice balance_due bucketed by age (days since invoice_date).
    bucket_0_15: Decimal
    bucket_16_30: Decimal
    bucket_31_60: Decimal
    bucket_60_plus: Decimal


class DebtorAgingResponse(BaseModel):

    as_of_date: date

    rows: list[DebtorAgingRow]

    # Grand totals per bucket across all debtors.
    total_outstanding: Decimal
    total_0_15: Decimal
    total_16_30: Decimal
    total_31_60: Decimal
    total_60_plus: Decimal

    count: int
