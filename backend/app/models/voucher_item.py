from __future__ import annotations

from decimal import Decimal
from sqlalchemy import ForeignKey, Enum as SqlEnum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import FuelType
from app.database.base import Base
from app.database.mixins import IDMixin, UUIDMixin, TimestampMixin


class VoucherItem(Base, IDMixin, UUIDMixin, TimestampMixin):
    __tablename__ = "voucher_items"

    voucher_id: Mapped[int] = mapped_column(
        ForeignKey("vouchers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    fuel_type: Mapped[FuelType] = mapped_column(
        SqlEnum(FuelType),
        nullable=False,
    )

    quantity_liters: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    rate_per_liter: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # Relationships
    voucher = relationship("Voucher", back_populates="items")
