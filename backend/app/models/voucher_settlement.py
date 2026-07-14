from __future__ import annotations

from decimal import Decimal
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class VoucherSettlement(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "voucher_settlements"

    # ======================================================
    # Payment Reference
    # ======================================================
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    payment = relationship(
        "Payment",
        back_populates="settlements",
    )

    # ======================================================
    # Voucher Reference
    # ======================================================
    voucher_id: Mapped[int] = mapped_column(
        ForeignKey("vouchers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    voucher = relationship(
        "Voucher",
        back_populates="settlements",
    )

    # ======================================================
    # Settlement Details
    # ======================================================
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<VoucherSettlement("
            f"payment_id={self.payment_id}, "
            f"voucher_id={self.voucher_id}, "
            f"amount={self.amount}"
            f")>"
        )
