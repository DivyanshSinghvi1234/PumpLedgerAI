from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import Date, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class DailySheet(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "daily_sheets"

    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # ── Time-window snapshotting ──────────────────────────────────────────────
    # When the sheet is generated, we record which time window it covers.
    # Vouchers are then filtered by their created_at against this window
    # so that any voucher saved after period_end belongs to the next sheet.
    period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # ─────────────────────────────────────────────────────────────────────────

    manual_sheet_image: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    # ── Financial reconciliation & expenses ──────────────────────────────────
    actual_cash_collected: Mapped[float | None] = mapped_column(
        nullable=True,
    )

    cash_shortage_excess: Mapped[float | None] = mapped_column(
        nullable=True,
    )

    expenses_data: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )
    # Operator-entered additions to the payment-mode totals. Voucher amounts
    # remain the source of truth; these cover walk-in or otherwise unvouchered
    # sales that still need to appear in the daily settlement.
    manual_payment_mode_amounts_data: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )
    # ─────────────────────────────────────────────────────────────────────────

    __table_args__ = (
        UniqueConstraint("pump_id", "date", name="uq_daily_sheet_pump_date"),
    )
