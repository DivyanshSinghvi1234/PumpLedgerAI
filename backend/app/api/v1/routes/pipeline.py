from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.database.scoping import active_pump_id
from app.models.pump import Pump
from app.models.user import User
from app.services.daily_pipeline_service import DailyPipelineService

router = APIRouter(prefix="/pipeline", tags=["Daily Pipeline & Audit"])
service = DailyPipelineService()


def _get_pump_id(db: Session) -> int:
    pid = active_pump_id.get()
    if pid is not None:
        return pid
    p = db.scalars(select(Pump).where(Pump.is_active.is_(True))).first()
    return p.id if p else 1


class FixLegacyRequest(BaseModel):
    bank_account_uuid: Optional[str] = None
    on_date: Optional[date] = None


class RecalculateBalancesRequest(BaseModel):
    customer_uuid: Optional[str] = None


@router.get("/snapshot")
def get_daily_snapshot(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    d = target_date or date.today()
    pump_id = _get_pump_id(db)
    return service.get_daily_snapshot(db, d, pump_id)


@router.get("/audit-5-point")
def get_5_point_audit(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    d = target_date or date.today()
    pump_id = _get_pump_id(db)
    return service.run_5_point_audit(db, d, pump_id)


@router.get("/pre-lock-check")
def pre_lock_check(
    target_date: Optional[date] = Query(default=None),
    notes: Optional[str] = Query(default=None),
    responsible_employee_id: Optional[int] = Query(default=None),
    physical_cash_counted: Optional[Decimal] = Query(default=None),
    cash_to_next_day: Decimal = Query(default=Decimal("0.00")),
    db: Session = Depends(get_db),
):
    d = target_date or date.today()
    pump_id = _get_pump_id(db)
    return service.pre_lock_check(
        db,
        d,
        pump_id,
        notes=notes,
        responsible_employee_id=responsible_employee_id,
        physical_cash_counted=physical_cash_counted,
        cash_to_next_day=cash_to_next_day,
    )


@router.post("/auto-balance-cash")
def auto_balance_unbilled_cash(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    d = target_date or date.today()
    pump_id = _get_pump_id(db)
    return service.auto_balance_unbilled_cash(db, d, pump_id, actor_id=current_user.id)


@router.get("/books-health")
def get_books_health(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    pump_id = _get_pump_id(db)
    return service.run_books_health_check(db, pump_id)


@router.post("/recalculate-balances")
def recalculate_customer_balances(
    payload: RecalculateBalancesRequest = RecalculateBalancesRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    pump_id = _get_pump_id(db)
    return service.recalculate_customer_balances(
        db,
        pump_id,
        customer_uuid=payload.customer_uuid,
        actor_id=current_user.id,
    )


@router.post("/fix-legacy")
def fix_legacy_entries(
    payload: FixLegacyRequest = FixLegacyRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    pump_id = _get_pump_id(db)
    return service.fix_legacy_entries(
        db,
        pump_id,
        bank_account_uuid=payload.bank_account_uuid,
        on_date=payload.on_date,
        actor_id=current_user.id,
    )


@router.get("/pre-export-audit")
def pre_export_audit(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pump_id = _get_pump_id(db)
    return service.pre_export_integrity_audit(db, pump_id, start_date, end_date)


@router.get("/timeline")
def get_daily_timeline(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    d = target_date or date.today()
    pump_id = _get_pump_id(db)
    return service.get_daily_cash_bank_timeline(db, d, pump_id)


@router.get("/check-duplicate")
def check_duplicate_numbers(
    invoice_number: Optional[str] = Query(default=None),
    reference_number: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.bank_account import BankTransaction
    from app.models.payment import Payment
    from app.models.voucher import Voucher

    pump_id = _get_pump_id(db)
    dup_invoice = False
    dup_ref = False
    matches: list[str] = []

    if invoice_number and invoice_number.strip():
        inv = invoice_number.strip()
        v = db.scalar(
            select(Voucher).where(
                Voucher.pump_id == pump_id,
                Voucher.is_active.is_(True),
                Voucher.invoice_number == inv,
            )
        )
        if v is not None:
            dup_invoice = True
            matches.append(f"Voucher #{v.invoice_number} on {v.invoice_date}")

    if reference_number and reference_number.strip():
        ref = reference_number.strip()
        p = db.scalar(
            select(Payment).where(
                Payment.pump_id == pump_id,
                Payment.is_active.is_(True),
                Payment.reference_number == ref,
            )
        )
        if p is not None:
            dup_ref = True
            matches.append(f"Payment on {p.payment_date} (Ref: {ref})")
        bt = db.scalar(
            select(BankTransaction).where(
                BankTransaction.pump_id == pump_id,
                BankTransaction.reference_number == ref,
            )
        )
        if bt is not None:
            dup_ref = True
            matches.append(f"Bank Txn on {bt.transaction_date} (Ref: {ref})")

    return {
        "duplicate_invoice": dup_invoice,
        "duplicate_reference": dup_ref,
        "matches": matches,
    }
