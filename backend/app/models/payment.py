from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Date,
    Enum as SqlEnum,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import PaymentMode, TallyStatus
from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class Payment(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "payments"

    # ======================================================
    # Customer Reference
    # ======================================================

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )

    customer = relationship(
        "Customer",
        back_populates="payments",
    )

    settlements = relationship(
        "VoucherSettlement",
        back_populates="payment",
        cascade="all, delete-orphan",
    )

    # ======================================================
    # Payment Details
    # ======================================================

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    payment_mode: Mapped[PaymentMode] = mapped_column(
        SqlEnum(PaymentMode),
        nullable=False,
    )

    payment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    bank_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    bank_account = relationship("BankAccount")

    # Optional external reference (UPI txn id, cheque number, etc.)
    reference_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )


    remarks: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    tally_status: Mapped[TallyStatus] = mapped_column(
        SqlEnum(TallyStatus),
        default=TallyStatus.PENDING,
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Payment("
            f"amount={self.amount}, "
            f"mode='{self.payment_mode}'"
            f")>"
        )
