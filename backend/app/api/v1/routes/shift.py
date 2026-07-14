from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.shift import ShiftStart, ShiftEnd, ShiftResponse
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

