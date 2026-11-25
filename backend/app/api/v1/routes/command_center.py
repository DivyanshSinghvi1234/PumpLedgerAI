from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.database.scoping import active_pump_id
from app.models.pump import Pump
from app.services.command_center_service import CommandCenterService

router = APIRouter(prefix="/command-center", tags=["Owner Command Center"])
service = CommandCenterService()


@router.get(
    "",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def get_command_center(
    forecast_days: int = Query(default=14, ge=1, le=60),
    db: Session = Depends(get_db),
):
    pid = active_pump_id.get()
    if pid is None:
        p = db.scalars(select(Pump).where(Pump.is_active.is_(True))).first()
        pid = p.id if p else 1
    return service.get_summary(db, pump_id=pid, forecast_days=forecast_days)
