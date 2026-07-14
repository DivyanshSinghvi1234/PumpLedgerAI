from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.nozzle import (
    NozzleCreate,
    NozzleUpdate,
    NozzleResponse,
    FuelDispenserCreate,
    FuelDispenserUpdate,
    FuelDispenserResponse,
    BulkNozzleReadingCreate,
    NozzleReadingResponse,
    BulkFormResponse,
)
from app.services.nozzle_service import NozzleService

router = APIRouter(prefix="/nozzles", tags=["Nozzles"])
service = NozzleService()


@router.post(
    "/dispensers",
    response_model=FuelDispenserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_dispenser(
    data: FuelDispenserCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.create_dispenser(db, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/dispensers",
    response_model=list[FuelDispenserResponse],
)
def list_dispensers(
    db: Session = Depends(get_db),
):
    return service.get_dispensers(db)


@router.post(
    "/dispensers/{dispenser_uuid}/nozzles",
    response_model=NozzleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_nozzle(
    dispenser_uuid: str,
    data: NozzleCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.create_nozzle(db, dispenser_uuid, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put(
    "/{nozzle_uuid}",
    response_model=NozzleResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def update_nozzle(
    nozzle_uuid: str,
    data: NozzleUpdate,
    db: Session = Depends(get_db),
):
    try:
        return service.update_nozzle(db, nozzle_uuid, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{nozzle_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_nozzle(
    nozzle_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        service.delete_nozzle(db, nozzle_uuid)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/readings/bulk-form",
    response_model=BulkFormResponse,
)
def get_bulk_readings_form(
    reading_date: date,
    db: Session = Depends(get_db),
):
    try:
        return service.get_bulk_form(db, reading_date)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/readings/bulk",
    response_model=list[NozzleReadingResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def post_bulk_readings(
    data: BulkNozzleReadingCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.post_bulk_readings(db, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put(
    "/dispensers/{dispenser_uuid}",
    response_model=FuelDispenserResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def update_dispenser(
    dispenser_uuid: str,
    data: FuelDispenserUpdate,
    db: Session = Depends(get_db),
):
    try:
        return service.update_dispenser(db, dispenser_uuid, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/dispensers/{dispenser_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_dispenser(
    dispenser_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        service.delete_dispenser(db, dispenser_uuid)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/readings",
    response_model=list[NozzleReadingResponse],
)
def list_nozzle_readings(
    db: Session = Depends(get_db),
):
    return service.get_all_readings(db)
