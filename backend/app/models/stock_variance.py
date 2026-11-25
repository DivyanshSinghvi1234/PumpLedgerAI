from __future__ import annotations

from datetime import date
from sqlalchemy import Date, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class StockVariance(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """Daily fuel tank accountability record comparing book stock vs physical dip."""

    __tablename__ = "stock_variances"

    __table_args__ = (
        UniqueConstraint("pump_id", "tank_id", "variance_date", name="uq_stock_variance_tank_date"),
    )

    tank_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_tanks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    variance_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    opening_stock: Mapped[float] = mapped_column(Float, nullable=False)
    deliveries_received: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    meter_sales: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    testing_qty: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    book_stock: Mapped[float] = mapped_column(Float, nullable=False)

    physical_dip: Mapped[float | None] = mapped_column(Float, nullable=True)
    variance_liters: Mapped[float | None] = mapped_column(Float, nullable=True)
    variance_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # OK | WARNING | CRITICAL | PENDING_DIP
    status: Mapped[str] = mapped_column(
        String(20),
        default="PENDING_DIP",
        nullable=False,
    )

    threshold_percent: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        nullable=False,
    )

    fuel_tank = relationship("FuelTank")
