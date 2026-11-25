from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class EmployeeAttendance(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """Daily attendance record for an employee, auto-populated from closed shifts
    or manually adjusted (PRESENT, ABSENT, HALF_DAY, LEAVE) for pro-rated payroll."""

    __tablename__ = "employee_attendance"
    __table_args__ = (
        UniqueConstraint(
            "pump_id",
            "employee_id",
            "attendance_date",
            name="uq_employee_attendance_pump_emp_date",
        ),
    )

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # PRESENT | ABSENT | HALF_DAY | LEAVE
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PRESENT")

    overtime_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    shift_id: Mapped[int | None] = mapped_column(
        ForeignKey("shifts.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(String(200), nullable=True)

    employee = relationship("Employee")
