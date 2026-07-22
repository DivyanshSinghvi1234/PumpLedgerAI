from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.csv_export import csv_streaming_response
from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.core.exceptions import CustomerNotFoundError
from app.schemas.report import (
    CustomerReportResponse,
    DailyReportResponse,
    DebtorAgingResponse,
    LedgerReportResponse,
    VoucherReportResponse,
)
from app.services.report_service import ReportService

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)

service = ReportService()

# Reports are a management function (CLAUDE.md role matrix).
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


# ======================================================
# Voucher Report
# ======================================================

@router.get(
    "/vouchers",
    response_model=VoucherReportResponse,
    dependencies=manager,
)
def voucher_report(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    fuel_type: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    verification_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.voucher_report(
        db,
        from_date=from_date,
        to_date=to_date,
        fuel_type=fuel_type,
        payment_mode=payment_mode,
        verification_status=verification_status,
    )


@router.get(
    "/vouchers/export",
    dependencies=manager,
)
def voucher_report_export(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    fuel_type: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    verification_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    header, rows = service.voucher_report_csv(
        db,
        from_date=from_date,
        to_date=to_date,
        fuel_type=fuel_type,
        payment_mode=payment_mode,
        verification_status=verification_status,
    )
    return csv_streaming_response(
        "voucher_report.csv",
        header,
        rows,
    )


# ======================================================
# Customer Report
# ======================================================

@router.get(
    "/customers",
    response_model=CustomerReportResponse,
    dependencies=manager,
)
def customer_report(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.customer_report(db, search=search)


@router.get(
    "/customers/export",
    dependencies=manager,
)
def customer_report_export(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    header, rows = service.customer_report_csv(
        db,
        search=search,
    )
    return csv_streaming_response(
        "customer_report.csv",
        header,
        rows,
    )


# ======================================================
# Ledger Report (per-customer statement)
# ======================================================

@router.get(
    "/ledger/{customer_uuid}",
    response_model=LedgerReportResponse,
    dependencies=manager,
)
def ledger_report(
    customer_uuid: str,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        return service.ledger_report(
            db,
            customer_uuid,
            from_date=from_date,
            to_date=to_date,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/ledger/{customer_uuid}/export",
    dependencies=manager,
)
def ledger_report_export(
    customer_uuid: str,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        header, rows = service.ledger_report_csv(
            db,
            customer_uuid,
            from_date=from_date,
            to_date=to_date,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return csv_streaming_response(
        "ledger_report.csv",
        header,
        rows,
    )


# ======================================================
# Daily Sales
# ======================================================

@router.get(
    "/daily-sales",
    response_model=DailyReportResponse,
    dependencies=manager,
)
def daily_sales(
    on_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.daily_sales(
        db,
        on_date=on_date or date.today(),
    )


@router.get(
    "/daily-sales/export",
    dependencies=manager,
)
def daily_sales_export(
    on_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    header, rows = service.daily_sales_csv(
        db,
        on_date=on_date or date.today(),
    )
    return csv_streaming_response(
        "daily_sales.csv",
        header,
        rows,
    )


# ======================================================
# Debtor Aging
# ======================================================

@router.get(
    "/debtor-aging",
    response_model=DebtorAgingResponse,
    dependencies=manager,
)
def debtor_aging(
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.debtor_aging_report(db, as_of=as_of)


@router.get(
    "/debtor-aging/export",
    dependencies=manager,
)
def debtor_aging_export(
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    header, rows = service.debtor_aging_csv(db, as_of=as_of)
    return csv_streaming_response(
        "debtor_aging.csv",
        header,
        rows,
    )
