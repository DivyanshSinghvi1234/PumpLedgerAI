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
from app.core.enums import FuelType, PaymentMode


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

    tally_godown_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    dip_readings = relationship(
        "DipReading",
        back_populates="fuel_tank",
        cascade="all, delete-orphan",
    )
    deliveries = relationship("TankerDelivery", back_populates="fuel_tank", cascade="all, delete-orphan")



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

    deliveries_liters: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    nozzle_sales_liters: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unbilled_cash_variance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    physical_leak_variance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    variance_tolerance_liters: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    fuel_tank = relationship(
        "FuelTank",
        back_populates="dip_readings",
    )


class TankerDelivery(Base, IDMixin, UUIDMixin, TimestampMixin, ActiveMixin, PumpScopedMixin):
    __tablename__ = "tanker_deliveries"

    tank_id: Mapped[int] = mapped_column(ForeignKey("fuel_tanks.id", ondelete="CASCADE"), nullable=False, index=True)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity_liters: Mapped[float] = mapped_column(Float, nullable=False)
    density: Mapped[float | None] = mapped_column(Float, nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    procurement_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    payment_mode: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode), default=PaymentMode.CREDIT, server_default="CREDIT", nullable=False)

    fuel_tank = relationship("FuelTank", back_populates="deliveries")
