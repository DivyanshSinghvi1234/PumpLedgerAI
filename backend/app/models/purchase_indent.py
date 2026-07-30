from __future__ import annotations

from datetime import date
from enum import Enum as PyEnum
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


class OMCCompany(str, PyEnum):
    IOCL = "IOCL"
    BPCL = "BPCL"
    HPCL = "HPCL"
    RELIANCE = "RELIANCE"
    SHELL = "SHELL"
    NAYARA = "NAYARA"


class IndentStatus(str, PyEnum):
    INDENTED = "INDENTED"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class PurchaseIndent(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "purchase_indents"

    indent_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    omc_company: Mapped[OMCCompany] = mapped_column(Enum(OMCCompany), default=OMCCompany.IOCL, nullable=False)
    terminal_name: Mapped[str] = mapped_column(String(100), nullable=False)
    fuel_type: Mapped[FuelType] = mapped_column(Enum(FuelType), nullable=False)
    ordered_liters: Mapped[float] = mapped_column(Float, nullable=False)
    
    tank_truck_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expected_delivery_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[IndentStatus] = mapped_column(Enum(IndentStatus), default=IndentStatus.INDENTED, nullable=False, index=True)

    decanted_tank_id: Mapped[int | None] = mapped_column(ForeignKey("fuel_tanks.id", ondelete="SET NULL"), nullable=True)
    density_at_15c: Mapped[float | None] = mapped_column(Float, nullable=True)
    procurement_cost_per_liter: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_invoice_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)

    decanted_tank = relationship("FuelTank", foreign_keys=[decanted_tank_id])
