from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.core.dependencies import get_db, require_roles, get_current_user
from app.models.user import User
from app.core.enums import (
    FuelType,
    PaymentMode,
    UserRole,
    VerificationStatus,
    VoucherSortField,
    SortOrder,
)
from app.core.exceptions import (
    CustomerNotFoundError,
    DuplicateInvoiceError,
    VoucherNotFoundError,
)
from app.schemas.voucher import (
    PaginationResponse,
    VoucherCreate,
    VoucherListResponse,
    VoucherResponse,
    VoucherUpdate,
)
from app.services.voucher_service import VoucherService
from app.schemas.payment import VoucherSettleRequest
from app.services.voucher_payment_service import VoucherPaymentService

voucher_payment_service = VoucherPaymentService()

router = APIRouter(
    prefix="/vouchers",
    tags=["Vouchers"],
)

service = VoucherService()


@router.post(
    "",
    response_model=VoucherResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_voucher(
    voucher: VoucherCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create(
            db,
            voucher,
            actor_id=current_user.id,
        )

    except DuplicateInvoiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.get(
    "",
    response_model=VoucherListResponse,
)
def get_vouchers(
    search: str | None = Query(
        default=None,
        description="Search invoice, customer or vehicle",
    ),

    fuel_type: str | None = Query(
        default=None,
    ),

    payment_mode: str | None = Query(
        default=None,
    ),

    payment_status: str | None = Query(
        default=None,
        description="Filter by settlement status (UNPAID/PARTIAL/PAID)",
    ),

    customer_uuid: str | None = Query(
        default=None,
        description="Only vouchers for this customer",
    ),

    verification_status: str | None = Query(
        default=None,
    ),

    from_date: date | None = Query(
        default=None,
    ),

    to_date: date | None = Query(
        default=None,
    ),

    from_datetime: datetime | None = Query(
        default=None,
        description="Filter vouchers saved/created on or after this UTC datetime (ISO 8601, e.g. 2024-01-15T09:00:00)",
    ),

    to_datetime: datetime | None = Query(
        default=None,
        description="Filter vouchers saved/created on or before this UTC datetime (ISO 8601, e.g. 2024-01-15T18:00:00)",
    ),

    page: int = Query(
        default=1,
        ge=1,
    ),

    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
    ),

    sort_by: VoucherSortField = Query(
        default=VoucherSortField.invoice_date,
    ),

    sort_order: SortOrder = Query(
        default=SortOrder.desc,
    ),

    db: Session = Depends(get_db),
):

    # Treat empty-string query params as "no filter" (the frontend sends
    # e.g. fuel_type= when a dropdown is on "All").
    items, total = service.search(
        db=db,
        search=search or None,
        fuel_type=fuel_type or None,
        payment_mode=payment_mode or None,
        verification_status=verification_status or None,
        from_date=from_date,
        to_date=to_date,
        from_datetime=from_datetime,
        to_datetime=to_datetime,
        page=page,
        page_size=page_size,
        sort_by=sort_by.value,
        sort_order=sort_order.value,
    )

    total_pages = max(
        1,
        (total + page_size - 1) // page_size,
    )

    return VoucherListResponse(
        items=items,
        pagination=PaginationResponse(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )


@router.get(
    "/{voucher_uuid}",
    response_model=VoucherResponse,
)
def get_voucher(
    voucher_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        return service.get_by_uuid(
            db,
            voucher_uuid,
        )

    except VoucherNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.put(
    "/{voucher_uuid}",
    response_model=VoucherResponse,
)
def update_voucher(
    voucher_uuid: str,
    voucher: VoucherUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update(
            db,
            voucher_uuid,
            voucher,
            actor_id=current_user.id,
        )

    except VoucherNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post(
    "/{voucher_uuid}/verify",
    response_model=VoucherResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def verify_voucher(
    voucher_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.set_status(
            db,
            voucher_uuid,
            VerificationStatus.VERIFIED,
            actor_id=current_user.id,
        )

    except VoucherNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post(
    "/{voucher_uuid}/reject",
    response_model=VoucherResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def reject_voucher(
    voucher_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.set_status(
            db,
            voucher_uuid,
            VerificationStatus.REJECTED,
            actor_id=current_user.id,
        )

    except VoucherNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.delete(
    "/{voucher_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_voucher(
    voucher_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete(
            db,
            voucher_uuid,
            actor_id=current_user.id,
        )

    except VoucherNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post(
    "/{voucher_uuid}/settle",
    response_model=VoucherResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def settle_voucher(
    voucher_uuid: str,
    data: VoucherSettleRequest,
    db: Session = Depends(get_db),
):
    try:
        return voucher_payment_service.settle_voucher(db, voucher_uuid, data)
    except VoucherNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )