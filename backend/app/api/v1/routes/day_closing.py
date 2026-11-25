from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.day_closing import (
    DayClosingCreate,
    DayClosingDraftResponse,
    DayClosingResponse,
)
from app.services.day_closing_service import DayClosingService

router = APIRouter(prefix="/day-closings", tags=["Day Closing"])
service = DayClosingService()


@router.get("/draft", response_model=DayClosingDraftResponse)
def get_day_closing_draft(
    closing_date: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
):
    return service.compute_draft(db, closing_date or date.today())


@router.post("", response_model=DayClosingResponse, status_code=status.HTTP_201_CREATED)
def close_day(
    payload: DayClosingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.save_closing(db, payload, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("", response_model=list[DayClosingResponse])
def list_day_closings(
    limit: int = Query(default=30, ge=1, le=180),
    db: Session = Depends(get_db),
):
    return service.list_closings(db, limit=limit)


@router.get("/{closing_uuid}", response_model=DayClosingResponse)
def get_day_closing(
    closing_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        return service.get_by_uuid(db, closing_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/{closing_uuid}/reopen",
    response_model=DayClosingResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def reopen_day_closing(
    closing_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.reopen_closing(db, closing_uuid, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
