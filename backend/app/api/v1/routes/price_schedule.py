from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole, FuelType
from app.schemas.price_schedule import (
    PriceScheduleCreate,
    PriceScheduleResponse,
)
from app.services.price_schedule_service import PriceScheduleService

router = APIRouter(prefix="/price-schedules", tags=["Price Schedules"])
service = PriceScheduleService()


@router.post(
    "",
    response_model=PriceScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_schedule(
    data: PriceScheduleCreate,
    db: Session = Depends(get_db),
):
    return service.create_schedule(
        db,
        fuel_type=data.fuel_type,
        rate=data.rate,
        effective_from=data.effective_from,
    )


@router.get(
    "/active-rate",
    response_model=dict,
)
def get_active_rate(
    fuel_type: FuelType,
    at_time: datetime | None = None,
    db: Session = Depends(get_db),
):
    # Perform pending applications
    service.apply_pending_schedules(db)
    
    rate = service.get_active_rate(db, fuel_type, at_time)
    if rate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active rate schedule found for {fuel_type.value}",
        )
    return {
        "fuel_type": fuel_type,
        "rate": rate,
    }
