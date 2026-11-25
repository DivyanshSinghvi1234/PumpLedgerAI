from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class ShiftHandover(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """Digital shift handover sign-off between outgoing and incoming attendants,
    locking cash float + meter snapshot and auto-posting verified shortages."""

    __tablename__ = "shift_handovers"

    handover_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    outgoing_employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    incoming_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    cash_expected: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    cash_handed_over: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    variance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    meter_snapshot: Mapped[list | None] = mapped_column(JSON, nullable=True)

    outgoing_confirmed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    incoming_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    incoming_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shortage_posted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)

    outgoing_employee = relationship("Employee", foreign_keys=[outgoing_employee_id])
    incoming_employee = relationship("Employee", foreign_keys=[incoming_employee_id])
