from __future__ import annotations

from datetime import date
from decimal import Decimal
from sqlalchemy import Boolean, Date, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class ShiftSettlement(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """8:00 PM / Shift-end settlement sheet supporting floating staff, 6 AM price splits,
    pooled Cash/UPI/Card/OMC Fleet collections, float handover, and cash denomination shortage."""

    __tablename__ = "shift_settlements"

    settlement_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
        index=True,
    )

    # DAY_SHIFT (8 AM - 8 PM) | NIGHT_SHIFT (8 PM - 8 AM)
    shift_label: Mapped[str] = mapped_column(
        String(30),
        default="DAY_SHIFT",
        nullable=False,
    )

    attendant_names: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    responsible_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    opening_float: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    gross_meter_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    credit_sales_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    upi_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    card_edc_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    omc_fleet_card_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    mdr_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    # PENDING | SETTLED
    digital_settlement_status: Mapped[str] = mapped_column(
        String(20),
        default="PENDING",
        nullable=False,
    )

    expenses_cash_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    cash_handed_to_next_shift: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    expected_cash_in_hand: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    actual_cash_counted: Mapped[Decimal] = mapped_column(
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
    coins_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    charge_shortage_to_staff: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    nozzle_lines: Mapped[list | None] = mapped_column(JSON, nullable=True)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    responsible_employee = relationship("Employee")
