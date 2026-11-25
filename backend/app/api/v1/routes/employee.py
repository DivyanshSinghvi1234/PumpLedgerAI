from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.core.exceptions import (
    DuplicateEmployeeEmailError,
    EmployeeNotFoundError,
)
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    StaffLedgerEntryCreate,
    StaffLedgerEntryResponse,
    StaffLedgerSummaryResponse,
    StaffPayrollPayRequest,
    StaffPayrollPayResponse,
    StaffPayrollPreviewResponse,
)
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employee Management"])
service = EmployeeService()


@router.get(
    "",
    response_model=list[EmployeeResponse],
)
def list_employees(
    db: Session = Depends(get_db),
):
    """Retrieve all active employees."""
    return service.get_all_active(db)


@router.post(
    "",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
):
    """Create a new employee profile."""
    try:
        return service.create(db, data)
    except DuplicateEmployeeEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "/payroll/preview",
    response_model=StaffPayrollPreviewResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def preview_payroll(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """Preview monthly salary, commission, advances/shortage deductions, and net pay."""
    billing_month = month or date.today().strftime("%Y-%m")
    return service.payroll_preview(db, billing_month)


@router.post(
    "/sync-from-users",
    response_model=list[EmployeeResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def sync_employees_from_users(
    db: Session = Depends(get_db),
):
    """Import active OPERATOR/MANAGER login accounts as Staff profiles."""
    return service.sync_from_users(db)


@router.put(
    "/{uuid}",
    response_model=EmployeeResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def update_employee(
    uuid: str,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    """Update an employee profile."""
    try:
        return service.update(db, uuid, data)
    except EmployeeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DuplicateEmployeeEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_employee(
    uuid: str,
    db: Session = Depends(get_db),
):
    """Soft-delete an employee profile."""
    try:
        service.delete(db, uuid)
    except EmployeeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{uuid}/ledger",
    response_model=StaffLedgerSummaryResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def get_employee_ledger(
    uuid: str,
    db: Session = Depends(get_db),
):
    """Get an employee's advance/loan/shortage balance and ledger entries."""
    try:
        return service.get_ledger(db, uuid)
    except EmployeeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{uuid}/ledger",
    response_model=StaffLedgerEntryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def record_employee_ledger_entry(
    uuid: str,
    data: StaffLedgerEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an advance, loan, shift shortage, commission, or repayment for an employee."""
    try:
        return service.record_ledger_entry(db, uuid, data, actor_id=current_user.id)
    except EmployeeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{uuid}/pay-salary",
    response_model=StaffPayrollPayResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def pay_employee_salary(
    uuid: str,
    data: StaffPayrollPayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Settle monthly salary, auto-deduct advances/shortages, and record expense."""
    try:
        return service.pay_salary(db, uuid, data, actor_id=current_user.id)
    except EmployeeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
