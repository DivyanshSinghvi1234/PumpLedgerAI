from __future__ import annotations

from datetime import date
from sqlalchemy import Enum, Float, ForeignKey, String, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)
from app.core.enums import FuelType


class FuelTank(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "fuel_tanks"

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    fuel_type: Mapped[FuelType] = mapped_column(
        Enum(FuelType),
        nullable=False,
    )

    capacity_liters: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    current_stock_liters: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    dip_readings = relationship(
        "DipReading",
        back_populates="fuel_tank",
        cascade="all, delete-orphan",
    )



class DipReading(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "dip_readings"

    tank_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_tanks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    reading_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
        index=True,
    )

    opening_dip_liters: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    closing_dip_liters: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    sales_liters_calculated: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    actual_sales_from_vouchers: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    variance_liters: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    fuel_tank = relationship(
        "FuelTank",
        back_populates="dip_readings",
    )
