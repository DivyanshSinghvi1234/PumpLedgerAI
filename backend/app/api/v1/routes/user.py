from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.core.exceptions import (
    DuplicateUsernameError,
    UserNotFoundError,
    SoleAdminConstraintError,
)
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services.user_service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)

service = UserService()


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.create(db, data)

    except DuplicateUsernameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.get(
    "",
    response_model=list[UserResponse],
)
def list_users(
    db: Session = Depends(get_db),
):
    return service.list_all(db)


@router.get(
    "/{user_uuid}",
    response_model=UserResponse,
)
def get_user(
    user_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        return service.get_by_uuid(db, user_uuid)

    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.put(
    "/{user_uuid}",
    response_model=UserResponse,
)
def update_user(
    user_uuid: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
):
    try:
        return service.update(db, user_uuid, data)

    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except SoleAdminConstraintError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.delete(
    "/{user_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_user(
    user_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        service.delete(db, user_uuid)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except SoleAdminConstraintError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
