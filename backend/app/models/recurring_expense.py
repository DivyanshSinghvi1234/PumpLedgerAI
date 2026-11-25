from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum as SqlEnum, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import PaymentMode
from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class RecurringExpense(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    """Scheduled recurring expense template (rent, electricity, internet, EMI, etc.)
    that surfaces due bills and posts them into Income/Expense + BankAccount in one click."""

    __tablename__ = "recurring_expenses"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Utilities")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # DAILY | WEEKLY | MONTHLY
    frequency: Mapped[str] = mapped_column(String(20), nullable=False, default="MONTHLY")

    # Day of month (1..31) for MONTHLY, or weekday (0=Mon..6=Sun) for WEEKLY
    due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)

    payment_mode: Mapped[PaymentMode] = mapped_column(
        SqlEnum(PaymentMode, name="payment_mode_enum", native_enum=False),
        nullable=False,
        default=PaymentMode.CASH,
    )

    bank_account_uuid: Mapped[str | None] = mapped_column(String(36), nullable=True)

    next_due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    last_posted_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
