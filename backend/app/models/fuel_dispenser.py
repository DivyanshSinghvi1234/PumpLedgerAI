from __future__ import annotations

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
)
from app.core.enums import NozzleStatus


class FuelDispenser(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
):
    __tablename__ = "fuel_dispensers"

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    status: Mapped[NozzleStatus] = mapped_column(
        Enum(NozzleStatus),
        default=NozzleStatus.ACTIVE,
        nullable=False,
    )

    # Relationships
    nozzles = relationship(
        "Nozzle",
        back_populates="dispenser",
        cascade="all, delete-orphan",
    )
