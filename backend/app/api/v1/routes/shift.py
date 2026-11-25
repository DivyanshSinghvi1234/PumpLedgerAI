from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.shift import (
    SettleDigitalRequest,
    ShiftEnd,
    ShiftResponse,
    ShiftSettlementCreate,
    ShiftSettlementDefaultsResponse,
    ShiftSettlementResponse,
    ShiftStart,
)
from app.schemas.shift_timetable import ShiftTimetableCreate, ShiftTimetableResponse, ShiftTimetableUpdate
from app.schemas.user import UserCreate, UserResponse
from app.services.shift_service import ShiftService

router = APIRouter(prefix="/shifts", tags=["Shifts & Handovers"])
service = ShiftService()


@router.post(
    "/start",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_shift(
    data: ShiftStart,
    db: Session = Depends(get_db),
):
    try:
        return service.start_shift(
            db,
            employee_uuid=data.employee_uuid,
            opening_cash=data.opening_cash,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/active",
    response_model=ShiftResponse | None,
)
def get_active_shift(
    db: Session = Depends(get_db),
):
    return service.get_active_shift(db)


@router.get(
    "",
    response_model=list[ShiftResponse],
)
def list_shifts(
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.shift import Shift
    return list(
        db.scalars(
            select(Shift)
            .options(joinedload(Shift.employee))
            .order_by(Shift.start_time.desc())
        ).all()
    )


@router.post(
    "/end",
    response_model=ShiftResponse,
)
def end_shift(
    data: ShiftEnd,
    db: Session = Depends(get_db),
):
    try:
        return service.end_shift(
            db,
            closing_cash_reported=data.closing_cash_reported,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/attendants",
    response_model=list[str],
)
def list_attendants(
    db: Session = Depends(get_db),
):
    """Retrieve full names of all active employees."""
    from sqlalchemy import select
    from app.models.employee import Employee
    users = db.scalars(
        select(Employee).where(Employee.is_active == True)
    ).all()
    names = [u.full_name for u in users]
    if not names:
        names = ["Ramesh Kumar", "Suresh Kumar"]
    return names


@router.get(
    "/timetables",
    response_model=list[ShiftTimetableResponse],
)
def list_timetables(
    db: Session = Depends(get_db),
):
    """Get all shift timetable slots, sorted by day and time."""
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.shift_timetable import ShiftTimetable
    return list(
        db.scalars(
            select(ShiftTimetable)
            .options(joinedload(ShiftTimetable.employee))
            .where(ShiftTimetable.is_active == True)
        ).all()
    )


@router.post(
    "/timetables",
    response_model=ShiftTimetableResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_timetable(
    data: ShiftTimetableCreate,
    db: Session = Depends(get_db),
):
    """Add a new attendant shift schedule slot."""
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.shift_timetable import ShiftTimetable
    from app.models.employee import Employee

    employee = db.scalar(select(Employee).where(Employee.uuid == data.employee_uuid))
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    slot = ShiftTimetable(
        employee_id=employee.id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return db.scalar(
        select(ShiftTimetable)
        .options(joinedload(ShiftTimetable.employee))
        .where(ShiftTimetable.id == slot.id)
    )


@router.put(
    "/timetables/{uuid}",
    response_model=ShiftTimetableResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def update_timetable(
    uuid: str,
    data: ShiftTimetableUpdate,
    db: Session = Depends(get_db),
):
    """Update a shift schedule slot hours."""
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.shift_timetable import ShiftTimetable

    slot = db.scalar(
        select(ShiftTimetable)
        .options(joinedload(ShiftTimetable.employee))
        .where(ShiftTimetable.uuid == uuid)
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")

    if data.day_of_week is not None:
        slot.day_of_week = data.day_of_week
    if data.start_time is not None:
        slot.start_time = data.start_time
    if data.end_time is not None:
        slot.end_time = data.end_time

    db.commit()
    db.refresh(slot)
    return slot


@router.delete(
    "/timetables/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_timetable(
    uuid: str,
    db: Session = Depends(get_db),
):
    """Remove a shift schedule slot."""
    from sqlalchemy import select
    from app.models.shift_timetable import ShiftTimetable
    slot = db.scalar(
        select(ShiftTimetable).where(ShiftTimetable.uuid == uuid)
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")
    db.delete(slot)
    db.commit()


# ======================================================
# 8:00 PM Daily Shift Settlements
# ======================================================

@router.get(
    "/settlements/defaults",
    response_model=ShiftSettlementDefaultsResponse,
)
def get_settlement_defaults(
    settlement_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.get_settlement_defaults(db, settlement_date or date.today())


@router.get(
    "/settlements",
    response_model=list[ShiftSettlementResponse],
)
def list_settlements(
    db: Session = Depends(get_db),
):
    return service.list_settlements(db)


@router.post(
    "/settlements",
    response_model=ShiftSettlementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_settlement(
    data: ShiftSettlementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create_settlement(db, data, actor_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ======================================================
# Digital Shift Handover Sign-Off
# ======================================================


from decimal import Decimal
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class HandoverCreateRequest(BaseModel):
    handover_date: date = Field(default_factory=date.today)
    outgoing_employee_uuid: str
    incoming_employee_uuid: str | None = None
    cash_expected: Decimal = Field(..., ge=0)
    cash_handed_over: Decimal = Field(..., ge=0)
    notes: str | None = Field(default=None, max_length=300)


class HandoverConfirmRequest(BaseModel):
    auto_post_shortage: bool = True


def _serialize_handover(h) -> dict:
    return {
        "uuid": str(h.uuid),
        "handover_date": h.handover_date.isoformat(),
        "outgoing_employee_uuid": str(h.outgoing_employee.uuid) if h.outgoing_employee else None,
        "outgoing_employee_name": h.outgoing_employee.full_name if h.outgoing_employee else "Unknown",
        "incoming_employee_uuid": str(h.incoming_employee.uuid) if h.incoming_employee else None,
        "incoming_employee_name": h.incoming_employee.full_name if h.incoming_employee else None,
        "cash_expected": float(h.cash_expected),
        "cash_handed_over": float(h.cash_handed_over),
        "variance": float(h.variance),
        "meter_snapshot": h.meter_snapshot or [],
        "outgoing_confirmed": h.outgoing_confirmed,
        "incoming_confirmed": h.incoming_confirmed,
        "incoming_confirmed_at": h.incoming_confirmed_at.isoformat() if h.incoming_confirmed_at else None,
        "shortage_posted": h.shortage_posted,
        "notes": h.notes,
    }


@router.get("/handovers")
def list_handovers(db: Session = Depends(get_db)):
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.shift_handover import ShiftHandover

    rows = db.scalars(
        select(ShiftHandover)
        .options(joinedload(ShiftHandover.outgoing_employee), joinedload(ShiftHandover.incoming_employee))
        .order_by(ShiftHandover.handover_date.desc(), ShiftHandover.id.desc())
        .limit(30)
    ).all()
    return [_serialize_handover(r) for r in rows]


@router.post("/handovers", status_code=status.HTTP_201_CREATED)
def create_handover(
    data: HandoverCreateRequest,
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.employee import Employee
    from app.models.nozzle import Nozzle
    from app.models.shift_handover import ShiftHandover

    out_emp = db.scalar(select(Employee).where(Employee.uuid == data.outgoing_employee_uuid))
    if not out_emp:
        raise HTTPException(status_code=404, detail="Outgoing employee not found")

    in_emp = None
    if data.incoming_employee_uuid:
        in_emp = db.scalar(select(Employee).where(Employee.uuid == data.incoming_employee_uuid))
        if not in_emp:
            raise HTTPException(status_code=404, detail="Incoming employee not found")

    nozzles = db.scalars(select(Nozzle).where(Nozzle.is_active.is_(True)).order_by(Nozzle.id.asc())).all()
    snapshot = [
        {"nozzle_name": n.name, "fuel_type": n.fuel_type.value, "reading": float(n.last_reading or 0.0)}
        for n in nozzles
    ]
    variance = (data.cash_handed_over - data.cash_expected).quantize(Decimal("0.01"))

    h = ShiftHandover(
        handover_date=data.handover_date,
        outgoing_employee_id=out_emp.id,
        incoming_employee_id=in_emp.id if in_emp else None,
        cash_expected=data.cash_expected,
        cash_handed_over=data.cash_handed_over,
        variance=variance,
        meter_snapshot=snapshot,
        outgoing_confirmed=True,
        incoming_confirmed=False,
        shortage_posted=False,
        notes=data.notes.strip() if data.notes else None,
        pump_id=out_emp.pump_id,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _serialize_handover(h)


@router.post("/handovers/{uuid}/confirm")
def confirm_handover(
    uuid: str,
    data: HandoverConfirmRequest | None = None,
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.shift_handover import ShiftHandover
    from app.models.staff_ledger_entry import StaffLedgerEntry

    h = db.scalar(select(ShiftHandover).where(ShiftHandover.uuid == uuid))
    if not h:
        raise HTTPException(status_code=404, detail="Shift handover not found")

    req = data or HandoverConfirmRequest()
    h.incoming_confirmed = True
    h.incoming_confirmed_at = datetime.now(timezone.utc)

    if req.auto_post_shortage and not h.shortage_posted and Decimal(str(h.variance)) < Decimal("0.00"):
        shortage_amt = abs(Decimal(str(h.variance))).quantize(Decimal("0.01"))
        db.add(
            StaffLedgerEntry(
                employee_id=h.outgoing_employee_id,
                entry_date=h.handover_date,
                entry_type="SHORTAGE",
                amount=shortage_amt,
                signed_amount=shortage_amt,
                remarks=f"Confirmed shift handover shortage ({h.handover_date.isoformat()})",
                reference_type="HANDOVER",
                reference_id=h.id,
                pump_id=h.pump_id,
            )
        )
        h.shortage_posted = True

    db.commit()
    db.refresh(h)
    return _serialize_handover(h)


@router.post(
    "/settlements/{uuid}/settle-digital",
    response_model=ShiftSettlementResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def settle_digital_batch(
    uuid: str,
    data: SettleDigitalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.settle_digital(
            db,
            settlement_uuid=uuid,
            bank_account_uuid=str(data.bank_account_uuid),
            settled_date=data.settled_date,
            actor_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ======================================================
# Digital Shift Handover Sign-Off
# ======================================================


from decimal import Decimal
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class HandoverCreateRequest(BaseModel):
    handover_date: date = Field(default_factory=date.today)
    outgoing_employee_uuid: str
    incoming_employee_uuid: str | None = None
    cash_expected: Decimal = Field(..., ge=0)
    cash_handed_over: Decimal = Field(..., ge=0)
    notes: str | None = Field(default=None, max_length=300)


class HandoverConfirmRequest(BaseModel):
    auto_post_shortage: bool = True


def _serialize_handover(h) -> dict:
    return {
        "uuid": str(h.uuid),
        "handover_date": h.handover_date.isoformat(),
        "outgoing_employee_uuid": str(h.outgoing_employee.uuid) if h.outgoing_employee else None,
        "outgoing_employee_name": h.outgoing_employee.full_name if h.outgoing_employee else "Unknown",
        "incoming_employee_uuid": str(h.incoming_employee.uuid) if h.incoming_employee else None,
        "incoming_employee_name": h.incoming_employee.full_name if h.incoming_employee else None,
        "cash_expected": float(h.cash_expected),
        "cash_handed_over": float(h.cash_handed_over),
        "variance": float(h.variance),
        "meter_snapshot": h.meter_snapshot or [],
        "outgoing_confirmed": h.outgoing_confirmed,
        "incoming_confirmed": h.incoming_confirmed,
        "incoming_confirmed_at": h.incoming_confirmed_at.isoformat() if h.incoming_confirmed_at else None,
        "shortage_posted": h.shortage_posted,
        "notes": h.notes,
    }


@router.get("/handovers")
def list_handovers(db: Session = Depends(get_db)):
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.shift_handover import ShiftHandover

    rows = db.scalars(
        select(ShiftHandover)
        .options(joinedload(ShiftHandover.outgoing_employee), joinedload(ShiftHandover.incoming_employee))
        .order_by(ShiftHandover.handover_date.desc(), ShiftHandover.id.desc())
        .limit(30)
    ).all()
    return [_serialize_handover(r) for r in rows]


@router.post("/handovers", status_code=status.HTTP_201_CREATED)
def create_handover(
    data: HandoverCreateRequest,
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.employee import Employee
    from app.models.nozzle import Nozzle
    from app.models.shift_handover import ShiftHandover

    out_emp = db.scalar(select(Employee).where(Employee.uuid == data.outgoing_employee_uuid))
    if not out_emp:
        raise HTTPException(status_code=404, detail="Outgoing employee not found")

    in_emp = None
    if data.incoming_employee_uuid:
        in_emp = db.scalar(select(Employee).where(Employee.uuid == data.incoming_employee_uuid))
        if not in_emp:
            raise HTTPException(status_code=404, detail="Incoming employee not found")

    nozzles = db.scalars(select(Nozzle).where(Nozzle.is_active.is_(True)).order_by(Nozzle.id.asc())).all()
    snapshot = [
        {"nozzle_name": n.name, "fuel_type": n.fuel_type.value, "reading": float(n.last_reading or 0.0)}
        for n in nozzles
    ]
    variance = (data.cash_handed_over - data.cash_expected).quantize(Decimal("0.01"))

    h = ShiftHandover(
        handover_date=data.handover_date,
        outgoing_employee_id=out_emp.id,
        incoming_employee_id=in_emp.id if in_emp else None,
        cash_expected=data.cash_expected,
        cash_handed_over=data.cash_handed_over,
        variance=variance,
        meter_snapshot=snapshot,
        outgoing_confirmed=True,
        incoming_confirmed=False,
        shortage_posted=False,
        notes=data.notes.strip() if data.notes else None,
        pump_id=out_emp.pump_id,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _serialize_handover(h)


@router.post("/handovers/{uuid}/confirm")
def confirm_handover(
    uuid: str,
    data: HandoverConfirmRequest | None = None,
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.shift_handover import ShiftHandover
    from app.models.staff_ledger_entry import StaffLedgerEntry

    h = db.scalar(select(ShiftHandover).where(ShiftHandover.uuid == uuid))
    if not h:
        raise HTTPException(status_code=404, detail="Shift handover not found")

    req = data or HandoverConfirmRequest()
    h.incoming_confirmed = True
    h.incoming_confirmed_at = datetime.now(timezone.utc)

    if req.auto_post_shortage and not h.shortage_posted and Decimal(str(h.variance)) < Decimal("0.00"):
        shortage_amt = abs(Decimal(str(h.variance))).quantize(Decimal("0.01"))
        db.add(
            StaffLedgerEntry(
                employee_id=h.outgoing_employee_id,
                entry_date=h.handover_date,
                entry_type="SHORTAGE",
                amount=shortage_amt,
                signed_amount=shortage_amt,
                remarks=f"Confirmed shift handover shortage ({h.handover_date.isoformat()})",
                reference_type="HANDOVER",
                reference_id=h.id,
                pump_id=h.pump_id,
            )
        )
        h.shortage_posted = True

    db.commit()
    db.refresh(h)
    return _serialize_handover(h)

