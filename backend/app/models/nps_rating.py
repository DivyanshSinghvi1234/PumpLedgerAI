from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class NPSRating(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "nps_ratings"

    voucher_id: Mapped[int | None] = mapped_column(
        ForeignKey("vouchers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    customer_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    rating: Mapped[int] = mapped_column(
        nullable=False,
    )

    feedback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    token: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    voucher = relationship("Voucher")
