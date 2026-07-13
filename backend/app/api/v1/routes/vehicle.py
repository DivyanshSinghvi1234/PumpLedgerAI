from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.vehicle import (
    VehicleCreate,
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

# Only managers and admins may mutate vehicles.
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


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