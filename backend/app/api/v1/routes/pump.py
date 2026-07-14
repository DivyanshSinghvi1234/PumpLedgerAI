from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.pump import PumpResponse, UserPumpAccessUpdate
from app.services.pump_service import (
    PumpAccessDeniedError,
    PumpNotFoundError,
    PumpService,
)
from app.services.user_service import UserService

router = APIRouter(
    prefix="/pumps",
    tags=["Pumps"],
)

pump_service = PumpService()
user_service = UserService()


@router.get(
    "",
    response_model=list[PumpResponse],
)
def list_pumps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List pumps accessible to the current user.
    ADMINs see all pumps; others see only their assigned pumps.
    """
    pumps = pump_service.get_user_pumps(db, current_user)
    return pumps


@router.get(
    "/{pump_uuid}",
    response_model=PumpResponse,
)
def get_pump(
    pump_uuid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single pump by UUID (validates user access)."""
    try:
        return pump_service.validate_user_has_pump_access(
            db, current_user, pump_uuid
        )
    except PumpNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except PumpAccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


@router.put(
    "/users/{user_uuid}/access",
    response_model=list[PumpResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def set_user_pump_access(
    user_uuid: str,
    data: UserPumpAccessUpdate,
    db: Session = Depends(get_db),
):
    """
    Admin-only: replace the pump assignments for a user.
    Returns the updated list of assigned pumps.
    """
    try:
        user = user_service.get_by_uuid(db, user_uuid)
        pump_service.set_user_pumps(db, user, data.pump_uuids)
        return pump_service.get_user_pumps(db, user)

    except PumpNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.get(
    "/users/{user_uuid}/access",
    response_model=list[PumpResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def get_user_pump_access(
    user_uuid: str,
    db: Session = Depends(get_db),
):
    """Admin-only: list the pumps assigned to a user."""
    user = user_service.get_by_uuid(db, user_uuid)
    return pump_service.get_user_pumps(db, user)
