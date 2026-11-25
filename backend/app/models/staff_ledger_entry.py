from __future__ import annotations

from datetime import date
from decimal import Decimal
from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class StaffLedgerEntry(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """Tracks staff advances, loans, shift shortages, commissions, and salary settlements."""

    __tablename__ = "staff_ledger_entries"

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    entry_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
        index=True,
    )

    # ADVANCE | LOAN | SHORTAGE | COMMISSION | SALARY_PAYMENT | REPAYMENT
    entry_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # Positive = employee owes pump (ADVANCE, LOAN, SHORTAGE)
    # Negative = deducted/repaid/settled (REPAYMENT, SALARY_SETTLEMENT)
    signed_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    reference_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    reference_id: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    employee = relationship("Employee")
