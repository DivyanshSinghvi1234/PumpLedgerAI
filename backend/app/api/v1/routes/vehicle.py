from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.core.exceptions import VehicleNotFoundError
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleLedgerResponse,
    VehicleListResponse,
    VehicleResponse,
    VehicleUpdate,
)
from app.services.vehicle_service import VehicleService

router = APIRouter(
    prefix="/vehicles",
    tags=["Vehicles"],
)

service = VehicleService()

# Allow admins, managers, and operators to mutate vehicles.
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))]


@router.post(
    "",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager,
)
def create_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
):
    return service.create(
        db,
        data,
    )


@router.get(
    "",
    response_model=VehicleListResponse,
)
def get_vehicles(
    search: str | None = Query(
        default=None,
        description="Search vehicle number, type or customer name",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = service.search(
        db,
        search=search,
        page=page,
        page_size=page_size,
    )

    return VehicleListResponse(
        items=items,
        pagination=build_pagination(
            page=page,
            page_size=page_size,
            total_items=total,
        ),
    )


@router.get(
    "/{vehicle_uuid}/ledger",
    response_model=VehicleLedgerResponse,
)
def get_vehicle_ledger(
    vehicle_uuid: str,
    db: Session = Depends(get_db),
):
    """Vehicle-level ledger: this vehicle's vouchers and live outstanding."""
    try:
        return service.ledger(db, vehicle_uuid)
    except VehicleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{vehicle_uuid}",
    response_model=VehicleResponse,
)
def get_vehicle(
    vehicle_uuid: str,
    db: Session = Depends(get_db),
):
    return service.get_by_uuid(
        db,
        vehicle_uuid,
    )


@router.put(
    "/{vehicle_uuid}",
    response_model=VehicleResponse,
    dependencies=manager,
)
def update_vehicle(
    vehicle_uuid: str,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
):
    return service.update(
        db,
        vehicle_uuid,
        data,
    )


@router.delete(
    "/{vehicle_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager,
)
def delete_vehicle(
    vehicle_uuid: str,
    db: Session = Depends(get_db),
):
    service.delete(
        db,
        vehicle_uuid,
    )