from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.repositories.report_repository import ReportRepository
from pydantic import BaseModel

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


class InvoiceAgingDetail(BaseModel):
    uuid: UUID
    invoice_number: str
    invoice_date: date
    total_amount: Decimal
    balance_due: Decimal
    age_days: int


class CustomerAgingOutline(BaseModel):
    customer_uuid: UUID
    customer_name: str
    mobile: str | None = None
    total_outstanding: Decimal
    bucket_0_15: Decimal
    bucket_15_30: Decimal
    bucket_30_60: Decimal
    bucket_60_plus: Decimal
    invoices: list[InvoiceAgingDetail]


class DebtorAgingTotals(BaseModel):
    bucket_0_15: Decimal
    bucket_15_30: Decimal
    bucket_30_60: Decimal
    bucket_60_plus: Decimal
    total_outstanding: Decimal


class DebtorAgingAnalyticsResponse(BaseModel):
    totals: DebtorAgingTotals
    customers: list[CustomerAgingOutline]


@router.get(
    "/debtor-aging",
    response_model=DebtorAgingAnalyticsResponse,
)
def get_debtor_aging_analytics(
    db: Session = Depends(get_db),
):
    repository = ReportRepository()
    open_vouchers = repository.open_credit_vouchers(db)

    today = date.today()
    by_customer = {}

    grand_totals = {
        "bucket_0_15": Decimal("0.00"),
        "bucket_15_30": Decimal("0.00"),
        "bucket_30_60": Decimal("0.00"),
        "bucket_60_plus": Decimal("0.00"),
        "total_outstanding": Decimal("0.00"),
    }

    for voucher, customer in open_vouchers:
        due = voucher.balance_due
        if due <= Decimal("0.00"):
            continue

        age_days = (today - voucher.invoice_date).days

        if customer.uuid not in by_customer:
            by_customer[customer.uuid] = {
                "customer_uuid": customer.uuid,
                "customer_name": customer.name,
                "mobile": customer.mobile,
                "total_outstanding": Decimal("0.00"),
                "bucket_0_15": Decimal("0.00"),
                "bucket_15_30": Decimal("0.00"),
                "bucket_30_60": Decimal("0.00"),
                "bucket_60_plus": Decimal("0.00"),
                "invoices": [],
            }

        client = by_customer[customer.uuid]
        client["total_outstanding"] += due
        grand_totals["total_outstanding"] += due

        invoice_detail = {
            "uuid": voucher.uuid,
            "invoice_number": voucher.invoice_number,
            "invoice_date": voucher.invoice_date,
            "total_amount": voucher.total_amount,
            "balance_due": due,
            "age_days": age_days,
        }
        client["invoices"].append(invoice_detail)

        if age_days <= 15:
            client["bucket_0_15"] += due
            grand_totals["bucket_0_15"] += due
        elif age_days <= 30:
            client["bucket_15_30"] += due
            grand_totals["bucket_15_30"] += due
        elif age_days <= 60:
            client["bucket_30_60"] += due
            grand_totals["bucket_30_60"] += due
        else:
            client["bucket_60_plus"] += due
            grand_totals["bucket_60_plus"] += due

    # Sort customers by total outstanding descending
    sorted_customers = sorted(
        by_customer.values(),
        key=lambda c: c["total_outstanding"],
        reverse=True,
    )

    return {
        "totals": grand_totals,
        "customers": sorted_customers,
    }
