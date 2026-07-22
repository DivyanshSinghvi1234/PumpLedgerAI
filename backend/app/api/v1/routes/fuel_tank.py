from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.fuel_tank import (
    FuelTankCreate,
    FuelTankUpdate,
    FuelTankResponse,
    DipReadingCreate,
    DipReadingResponse,
    TankerDeliveryCreate,
    TankerDeliveryResponse,
)
from app.services.fuel_tank_service import FuelTankService

router = APIRouter(prefix="/tanks", tags=["Fuel Tanks"])
service = FuelTankService()


@router.post(
    "/deliveries",
    response_model=TankerDeliveryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_delivery(data: TankerDeliveryCreate, db: Session = Depends(get_db)):
    try:
        return service.create_delivery(db, **data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/deliveries",
    response_model=list[TankerDeliveryResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def list_deliveries(db: Session = Depends(get_db)):
    return service.list_deliveries(db)


@router.post(
    "",
    response_model=FuelTankResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_tank(
    data: FuelTankCreate,
    db: Session = Depends(get_db),
):
    return service.create_tank(
        db,
        name=data.name,
        fuel_type=data.fuel_type,
        capacity_liters=data.capacity_liters,
        current_stock_liters=data.current_stock_liters,
        tally_godown_name=data.tally_godown_name,
    )


@router.get(
    "",
    response_model=list[FuelTankResponse],
)
def list_tanks(
    db: Session = Depends(get_db),
):
    return service.tank_repo.get_active(db)


@router.get(
    "/dips",
    response_model=list[DipReadingResponse],
)
def list_dips(
    db: Session = Depends(get_db),
):
    # Retrieve all physical dip readings, sorted by date descending
    from sqlalchemy import desc
    from app.models.fuel_tank import DipReading
    from sqlalchemy import select
    return list(
        db.scalars(
            select(DipReading).order_by(DipReading.reading_date.desc())
        ).all()
    )



@router.post(
    "/{uuid}/dips",
    response_model=DipReadingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def post_dip_reading(
    uuid: str,
    data: DipReadingCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.post_dip_reading(
            db,
            tank_uuid=uuid,
            opening_dip=data.opening_dip_liters,
            closing_dip=data.closing_dip_liters,
            reading_date=data.reading_date,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put(
    "/{uuid}",
    response_model=FuelTankResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def update_tank(
    uuid: str,
    data: FuelTankUpdate,
    db: Session = Depends(get_db),
):
    try:
        return service.update_tank(
            db,
            uuid=uuid,
            name=data.name,
            fuel_type=data.fuel_type,
            capacity_liters=data.capacity_liters,
            current_stock_liters=data.current_stock_liters,
            tally_godown_name=data.tally_godown_name,
            ignore_capacity=data.ignore_capacity,
        )
    except ValueError as e:
        err_msg = str(e)
        if "CAPACITY_WARNING" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=err_msg,
        )


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_tank(
    uuid: str,
    db: Session = Depends(get_db),
):
    try:
        service.delete_tank(db, uuid=uuid)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
