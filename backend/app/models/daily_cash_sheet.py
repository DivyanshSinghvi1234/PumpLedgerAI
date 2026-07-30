from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Numeric, String, UniqueConstraint, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import IDMixin, PumpScopedMixin, TimestampMixin, UUIDMixin


class DailyCashSheet(Base, IDMixin, UUIDMixin, TimestampMixin, PumpScopedMixin):
    """Stores daily register cash sheet entries per filling station (pump) and date."""

    __tablename__ = "daily_cash_sheets"

    sheet_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    notes_500: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_200: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_100: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_50: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_20: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes_10: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cash_sent_home: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    prev_deposit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    ledger_interest: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("pump_id", "sheet_date", name="uix_daily_cash_sheet_pump_date"),
    )
