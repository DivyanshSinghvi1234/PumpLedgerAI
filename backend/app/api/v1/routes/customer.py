from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.enums import UserRole
from app.core.exceptions import (
    CustomerNotFoundError,
    DuplicateCustomerCodeError,
    DuplicateCustomerGSTError,
    DuplicateCustomerPhoneError,
)
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdate,
    CustomerAutocompleteItem,
)
from app.schemas.payment import CustomerOutstandingResponse
from app.services.customer_service import CustomerService

router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)

service = CustomerService()

# Allow admins, managers, and operators to mutate customers.
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))]


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager,
)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create(db, data, actor_id=current_user.id)
    except (
        DuplicateCustomerCodeError,
        DuplicateCustomerGSTError,
        DuplicateCustomerPhoneError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=CustomerListResponse,
)
def get_customers(
    search: str | None = Query(
        default=None,
        description="Search customer name, mobile, code or GST number",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    items, total = service.search(
        db,
        search=search,
        page=page,
        page_size=page_size,
    )

    return CustomerListResponse(
        items=items,
        pagination=build_pagination(
            page=page,
            page_size=page_size,
            total_items=total,
        ),
    )
@router.get(
    "/search/autocomplete",
    response_model=list[CustomerAutocompleteItem],
)
def search_customers_autocomplete(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Autocomplete search for customer selection in payment form."""
    customers = service.search_autocomplete(db, search=q, limit=limit)
    return [
        CustomerAutocompleteItem(
            uuid=c.uuid,
            label=f"{c.name} ({c.customer_code or 'No Code'})",
            name=c.name,
            customer_code=c.customer_code,
            mobile=c.mobile,
            outstanding_balance=c.outstanding_balance,
        )
        for c in customers
    ]


@router.get(
    "/{customer_uuid}/outstanding",
    response_model=CustomerOutstandingResponse,
)
def get_customer_outstanding(
    customer_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        # get_by_uuid already overwrites outstanding_balance with the live
        # ledger-derived figure.
        customer = service.get_by_uuid(db, customer_uuid)
        return CustomerOutstandingResponse(
            customer_uuid=customer.uuid,
            customer_name=customer.name,
            outstanding_balance=customer.outstanding_balance,
            credit_limit=customer.credit_limit,
            opening_balance=customer.opening_balance,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{customer_uuid}",
    response_model=CustomerResponse,
)
def get_customer(
    customer_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        return service.get_by_uuid(db, customer_uuid)
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put(
    "/{customer_uuid}",
    response_model=CustomerResponse,
    dependencies=manager,
)
def update_customer(
    customer_uuid: str,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update(db, customer_uuid, data, actor_id=current_user.id)
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except (
        DuplicateCustomerCodeError,
        DuplicateCustomerGSTError,
        DuplicateCustomerPhoneError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager,
)
def delete_customer(
    uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete(db, uuid, actor_id=current_user.id)
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/whatsapp-digest",
    dependencies=manager,
)
def generate_whatsapp_digest(
    min_balance: float = 1.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.whatsapp_digest_service import WhatsAppDigestService
    digest_service = WhatsAppDigestService()
    return digest_service.get_customer_monthly_digest(
        db, min_balance=min_balance, actor_id=current_user.id
    )