from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole, signed_amount
from app.core.exceptions import CustomerNotFoundError
from app.schemas.ledger import (
    LedgerAdjustmentCreate,
    LedgerEntryResponse,
    LedgerListResponse,
)
from app.services.ledger_service import LedgerService

router = APIRouter(
    prefix="/customers",
    tags=["Ledger"],
)

service = LedgerService()

# Only managers and admins may post manual adjustments.
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


@router.get(
    "/{customer_uuid}/ledger",
    response_model=LedgerListResponse,
)
def get_customer_ledger(
    customer_uuid: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        return service.list_for_customer(
            db,
            customer_uuid,
            page=page,
            page_size=page_size,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{customer_uuid}/ledger/adjustments",
    response_model=LedgerEntryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager,
)
def create_ledger_adjustment(
    customer_uuid: str,
    data: LedgerAdjustmentCreate,
    db: Session = Depends(get_db),
):
    try:
        entry = service.create_adjustment(
            db,
            customer_uuid,
            data,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    # Return the newly-created entry with its signed effect. balance_after
    # for a single POST is the customer's new balance.
    return LedgerEntryResponse(
        uuid=entry.uuid,
        entry_type=entry.entry_type,
        amount=entry.amount,
        signed_amount=signed_amount(entry.entry_type, entry.amount),
        balance_after=entry.customer.outstanding_balance,
        entry_date=entry.entry_date,
        reference_type=entry.reference_type,
        remarks=entry.remarks,
    )
