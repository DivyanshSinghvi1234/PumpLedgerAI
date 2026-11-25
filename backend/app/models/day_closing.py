from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class DayClosing(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """Immutable end-of-day closing snapshot auto-computed from nozzle readings,
    vouchers, income/expense register, and physical cash denomination count."""

    __tablename__ = "day_closings"

    __table_args__ = (
        UniqueConstraint("pump_id", "closing_date", name="uq_day_closing_pump_date"),
    )

    closing_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # DRAFT | CLOSED | LOCKED
    status: Mapped[str] = mapped_column(
        String(20),
        default="CLOSED",
        nullable=False,
    )

    gross_meter_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    cash_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    upi_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    card_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    bank_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    credit_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    total_voucher_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    cash_expenses: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    opening_float: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    physical_cash_counted: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    cash_to_next_day: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    expected_cash: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    variance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    notes_500: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_200: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_100: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_50: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_20: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_10: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    coins: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    warnings: Mapped[list | None] = mapped_column(JSON, nullable=True)

    closed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    nozzle_snapshot: Mapped[list | None] = mapped_column(JSON, nullable=True)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    settlement_bank_account_uuid: Mapped[str | None] = mapped_column(String(36), nullable=True)

    cash_deposited_to_bank: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    synced_bank_txn_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    closed_by = relationship("User")
