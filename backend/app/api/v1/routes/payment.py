from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.core.exceptions import (
    CustomerNotFoundError,
    PaymentNotFoundError,
)
from app.schemas.payment import (
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
    PaymentFifoAllocateRequest,
)
from app.services.payment_service import PaymentService
from app.services.voucher_payment_service import VoucherPaymentService

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

service = PaymentService()
voucher_payment_service = VoucherPaymentService()

# Only managers and admins may record or reverse payments.
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


@router.post(
    "",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager,
)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.create(db, data)
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/allocate-fifo",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager,
)
def allocate_payment_fifo(
    data: PaymentFifoAllocateRequest,
    db: Session = Depends(get_db),
):
    try:
        return voucher_payment_service.allocate_payment_fifo(
            db,
            customer_uuid=str(data.customer_uuid),
            amount=data.amount,
            payment_mode=data.payment_mode,
            payment_date=data.payment_date,
            reference_number=data.reference_number,
            remarks=data.remarks,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=PaymentListResponse,
)
def get_payments(
    customer_uuid: str | None = Query(
        default=None,
        description="Filter payments by customer UUID",
    ),
    search: str | None = Query(
        default=None,
        description="Search reference number or customer name",
    ),
    payment_date: date | None = Query(
        default=None,
        description="Filter payments by exact date",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = service.search(
        db,
        customer_uuid=customer_uuid,
        search=search,
        payment_date=payment_date,
        page=page,
        page_size=page_size,
    )

    return PaymentListResponse(
        items=items,
        pagination=build_pagination(
            page=page,
            page_size=page_size,
            total_items=total,
        ),
    )


@router.get(
    "/{payment_uuid}",
    response_model=PaymentResponse,
)
def get_payment(
    payment_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        return service.get_by_uuid(db, payment_uuid)
    except PaymentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{payment_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager,
)
def delete_payment(
    payment_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        service.delete(db, payment_uuid)
    except PaymentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
