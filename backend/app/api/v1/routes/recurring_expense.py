from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.recurring_expense import (
    RecurringExpenseBatchPostResponse,
    RecurringExpenseCreate,
    RecurringExpensePostRequest,
    RecurringExpensePostResult,
    RecurringExpenseResponse,
    RecurringExpenseUpdate,
)
from app.services.recurring_expense_service import RecurringExpenseService

router = APIRouter(prefix="/recurring-expenses", tags=["Recurring Expenses"])
service = RecurringExpenseService()

manager_required = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


@router.get("", response_model=list[RecurringExpenseResponse])
def list_recurring_expenses(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.get("/due", response_model=list[RecurringExpenseResponse])
def list_due_recurring_expenses(
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.list_due(db, as_of=as_of)


@router.post(
    "",
    response_model=RecurringExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager_required,
)
def create_recurring_expense(
    data: RecurringExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create(db, data, actor_id=current_user.id)


@router.patch(
    "/{uuid}",
    response_model=RecurringExpenseResponse,
    dependencies=manager_required,
)
def update_recurring_expense(
    uuid: str,
    data: RecurringExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update(db, uuid, data, actor_id=current_user.id)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager_required,
)
def delete_recurring_expense(
    uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete(db, uuid, actor_id=current_user.id)


@router.post(
    "/{uuid}/post",
    response_model=RecurringExpensePostResult,
    dependencies=manager_required,
)
def post_recurring_expense(
    uuid: str,
    data: RecurringExpensePostRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = data or RecurringExpensePostRequest()
    return service.post_due(
        db,
        uuid,
        post_date=req.post_date,
        amount_override=req.amount_override,
        actor_id=current_user.id,
    )


@router.post(
    "/post-all-due",
    response_model=RecurringExpenseBatchPostResponse,
    dependencies=manager_required,
)
def post_all_due_recurring_expenses(
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.post_all_due(db, as_of=as_of, actor_id=current_user.id)
