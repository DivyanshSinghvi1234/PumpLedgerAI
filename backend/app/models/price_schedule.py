from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from sqlalchemy import Enum, Numeric, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)
from app.core.enums import FuelType


class PriceSchedule(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "price_schedules"

    fuel_type: Mapped[FuelType] = mapped_column(
        Enum(FuelType),
        nullable=False,
    )

    rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    is_applied: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
