from __future__ import annotations

from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
)


class ShiftTimetable(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
):
    __tablename__ = "shift_timetables"

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id"),
        nullable=False,
    )

    day_of_week: Mapped[str] = mapped_column(
        String(20),  # e.g., "Monday", "Tuesday"
        nullable=False,
    )

    start_time: Mapped[str] = mapped_column(
        String(10),  # e.g., "06:00 AM"
        nullable=False,
    )

    end_time: Mapped[str] = mapped_column(
        String(10),  # e.g., "02:00 PM"
        nullable=False,
    )

    # Relationships
    employee: Mapped[Employee] = relationship("Employee")
