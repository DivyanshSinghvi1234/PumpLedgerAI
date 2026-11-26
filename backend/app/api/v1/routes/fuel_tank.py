from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.fuel_tank import (
    FuelTankCreate,
    FuelTankUpdate,
    FuelTankResponse,
    DipReadingCreate,
    DipReadingResponse,
    TankerDeliveryCreate,
    TankerDeliveryResponse,
    TankTransferCreate,
    TankTransferResponse,
)
from app.services.fuel_tank_service import FuelTankService

router = APIRouter(prefix="/tanks", tags=["Fuel Tanks"])
service = FuelTankService()


@router.post(
    "/transfers",
    response_model=TankTransferResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_tank_transfer(data: TankTransferCreate, db: Session = Depends(get_db)):
    try:
        return service.create_tank_transfer(db, **data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/transfers",
    response_model=list[TankTransferResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def list_tank_transfers(db: Session = Depends(get_db)):
    return service.list_tank_transfers(db)


@router.delete(
    "/transfers/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_tank_transfer(uuid: str, db: Session = Depends(get_db)):
    try:
        service.delete_tank_transfer(db, transfer_uuid=uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc



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


@router.delete(
    "/deliveries/{delivery_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_delivery(
    delivery_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_delivery(db, delivery_uuid, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


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


@router.get(
    "/margin-analytics",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def get_margin_analytics(db: Session = Depends(get_db)):
    from app.database.scoping import active_pump_id
    from app.models.pump import Pump
    from sqlalchemy import select

    pid = active_pump_id.get()
    if pid is None:
        p = db.scalars(select(Pump).where(Pump.is_active.is_(True))).first()
        pid = p.id if p else 1
    return service.get_margin_analytics(db, pid)


@router.post(
    "/omc-ocr-autopilot",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def omc_ocr_autopilot(
    payload: dict,
    db: Session = Depends(get_db),
):
    from datetime import date as date_cls
    from app.core.enums import PaymentMode
    from app.database.scoping import active_pump_id
    from app.models.pump import Pump
    from sqlalchemy import select

    pid = active_pump_id.get()
    if pid is None:
        p = db.scalars(select(Pump).where(Pump.is_active.is_(True))).first()
        pid = p.id if p else 1
    try:
        return service.omc_invoice_ocr_autopilot(
            db,
            pump_id=pid,
            tank_uuid=payload["tank_uuid"],
            invoice_number=payload.get("invoice_number", ""),
            delivery_date=date_cls.fromisoformat(payload.get("delivery_date") or date_cls.today().isoformat()),
            quantity_liters=float(payload["quantity_liters"]),
            total_amount=float(payload["total_amount"]),
            density=float(payload["density"]) if payload.get("density") is not None else None,
            supplier_name=payload.get("supplier_name"),
            bank_account_uuid=payload.get("bank_account_uuid"),
            payment_mode=PaymentMode(payload.get("payment_mode", "BANK")),
            dip_before_liters=float(payload["dip_before_liters"]) if payload.get("dip_before_liters") is not None else None,
            dip_after_liters=float(payload["dip_after_liters"]) if payload.get("dip_after_liters") is not None else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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
