from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole, FuelType
from app.schemas.price_schedule import (
    PriceScheduleCreate,
    PriceScheduleResponse,
)
from app.services.price_schedule_service import PriceScheduleService
from app.core.exceptions import PriceScheduleNotFoundError

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


@router.post(
    "/sync",
    response_model=dict,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def sync_prices(
    db: Session = Depends(get_db),
):
    try:
        return service.sync_rajasthan_prices(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync live rates: {str(e)}",
        )


class SixAmRevisionRequest(BaseModel):
    effective_date: date
    petrol_rate: Decimal | None = Field(default=None, gt=0)
    diesel_rate: Decimal | None = Field(default=None, gt=0)
    speed_rate: Decimal | None = Field(default=None, gt=0)


@router.get("/6am-alert", response_model=dict)
def get_6am_alert(
    target_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.get_6am_alert(db, target_date=target_date)


@router.post(
    "/schedule-6am",
    response_model=list[PriceScheduleResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def schedule_6am_revision(
    data: SixAmRevisionRequest,
    db: Session = Depends(get_db),
):
    rates: dict[FuelType, Decimal] = {}
    if data.petrol_rate is not None:
        rates[FuelType.PETROL] = data.petrol_rate
    if data.diesel_rate is not None:
        rates[FuelType.DIESEL] = data.diesel_rate
    if data.speed_rate is not None:
        rates[FuelType.SPEED] = data.speed_rate
    if not rates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one fuel rate to schedule.",
        )
    return service.schedule_6am_revision(db, data.effective_date, rates)


@router.get(
    "",
    response_model=list[PriceScheduleResponse],
)
def list_schedules(
    db: Session = Depends(get_db),
):
    # Perform pending applications
    service.apply_pending_schedules(db)
    return service.get_all_schedules(db)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_schedule(
    uuid: str,
    db: Session = Depends(get_db),
):
    try:
        service.delete_schedule(db, uuid)
    except PriceScheduleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

