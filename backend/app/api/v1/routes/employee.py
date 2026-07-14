from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.core.exceptions import (
    DuplicateEmployeeEmailError,
    EmployeeNotFoundError,
)
from app.schemas.employee import EmployeeCreate, EmployeeResponse, EmployeeUpdate
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