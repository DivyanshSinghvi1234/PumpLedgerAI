from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Date,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import LedgerEntryType
from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
)


class LedgerEntry(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
):
    __tablename__ = "ledger_entries"

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
        back_populates="ledger_entries",
    )

    # ======================================================
    # Entry Details
    # ======================================================

    entry_type: Mapped[LedgerEntryType] = mapped_column(
        SqlEnum(LedgerEntryType),
        nullable=False,
    )

    # Always stored positive; direction comes from entry_type
    # (see app.core.enums.signed_amount).
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    entry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # ======================================================
    # Source Reference (for reversal)
    # ======================================================

    # "PAYMENT" / "VOUCHER" / "CUSTOMER" / "ADJUSTMENT"
    reference_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    # id of the source row that produced this entry
    reference_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    def __repr__(self) -> str:
        return (
            f"<LedgerEntry("
            f"type='{self.entry_type}', "
            f"amount={self.amount}"
            f")>"
        )
