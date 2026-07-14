from __future__ import annotations

from sqlalchemy import Enum, Float, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)
from app.core.enums import FuelType, NozzleStatus


class Nozzle(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "nozzles"

    dispenser_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_dispensers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    fuel_type: Mapped[FuelType] = mapped_column(
        Enum(FuelType),
        nullable=False,
    )
    last_reading: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    status: Mapped[NozzleStatus] = mapped_column(
        Enum(NozzleStatus),
        default=NozzleStatus.ACTIVE,
        nullable=False,
    )

    # Relationships
    dispenser = relationship(
        "FuelDispenser",
        back_populates="nozzles",
    )
    readings = relationship(
        "NozzleReading",
        back_populates="nozzle",
        cascade="all, delete-orphan",
    )
