from __future__ import annotations

from datetime import date
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.enums import UserRole
from app.models.user import User
from app.core.exceptions import (
    DailySheetNotFoundError,
    DuplicateDailySheetError,
)
from app.schemas.daily_sheet import (
    DailySheetCreate,
    DailySheetUpdate,
    DailySheetResponse,
)
from app.services.daily_sheet_service import DailySheetService

router = APIRouter(prefix="/daily-sheets", tags=["Daily Sheets"])
service = DailySheetService()

UPLOAD_DIR = Path("storage/daily-sheets")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.get(
    "",
    response_model=list[DailySheetResponse],
)
def list_daily_sheets(
    db: Session = Depends(get_db),
):
    """Return all daily sheets, newest-date first."""
    return service.list_daily_sheets(db)


@router.get(
    "/{date_val}",
    response_model=DailySheetResponse | None,
)
def get_daily_sheet(
    date_val: date,
    db: Session = Depends(get_db),
):
    return service.get_daily_sheet(db, date_val)


@router.post(
    "",
    response_model=DailySheetResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))],
)
def create_daily_sheet(
    data: DailySheetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create_daily_sheet(
            db,
            data.date,
            data.remarks,
            period_start=data.period_start,
            period_end=data.period_end,
            actor_id=current_user.id,
        )
    except DuplicateDailySheetError as exc:
        # Return 409 Conflict so the frontend can detect the duplicate and
        # show a clear "Sheet already exists" warning instead of a generic error.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.put(
    "/{uuid}",
    response_model=DailySheetResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))],
)
def update_daily_sheet(
    uuid: str,
    data: DailySheetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_daily_sheet(
            db,
            uuid,
            remarks=data.remarks,
            manual_sheet_image=data.manual_sheet_image,
            date_val=data.date,
            period_start=data.period_start,
            period_end=data.period_end,
            actor_id=current_user.id,
        )
    except DailySheetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except DuplicateDailySheetError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.post(
    "/{uuid}/upload",
    response_model=DailySheetResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))],
)
async def upload_manual_sheet_image(
    uuid: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG and PNG images are supported.",
        )

    extension = Path(file.filename).suffix.lower()
    filename = f"{uuid4()}{extension}"
    filepath = UPLOAD_DIR / filename

    try:
        with filepath.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        relative_path = f"daily-sheets/{filename}"
        return service.update_daily_sheet(db, uuid, manual_sheet_image=relative_path, actor_id=current_user.id)
    except DailySheetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(exc)}",
        )
