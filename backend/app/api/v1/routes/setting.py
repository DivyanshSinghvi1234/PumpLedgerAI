import os
from datetime import date
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.pump_setting import PumpSettingCreate, PumpSettingResponse
from app.services.pump_setting_service import PumpSettingService

router = APIRouter(prefix="/settings", tags=["settings"])
setting_service = PumpSettingService()
manager_protected = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


@router.get("/backup/download", dependencies=manager_protected)
def download_database_backup():
    """Stream a password-protected/safe point-in-time backup of the SQLite database."""
    db_url = os.getenv("DATABASE_URL", "sqlite:///pumpledger.db")
    db_path = db_url.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database backup file not found on server.",
        )

    timestamp = date.today().strftime("%Y%m%d")
    return FileResponse(
        path=db_path,
        filename=f"pumpledger_backup_{timestamp}.db",
        media_type="application/octet-stream",
    )


@router.get("/{key}")
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    val = setting_service.get_setting(db, key)
    return {"key": key, "value": val}


@router.post("/{key}")
def save_setting(
    key: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    val = data.get("value")
    setting = setting_service.upsert_setting(db, key, val)
    return {"key": setting.setting_key, "value": setting.setting_value}
