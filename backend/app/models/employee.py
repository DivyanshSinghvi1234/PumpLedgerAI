from __future__ import annotations

from decimal import Decimal
from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class Employee(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    __tablename__ = "employees"

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="OPERATOR",
    )

    base_salary: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    commission_rate_per_liter: Mapped[Decimal] = mapped_column(
        Numeric(10, 4),
        default=Decimal("0.0000"),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
