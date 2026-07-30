from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String, Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    PumpScopedMixin,
    TimestampMixin,
    UUIDMixin,
)


class BankAccount(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    __tablename__ = "bank_accounts"

    account_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    bank_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    account_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    ifsc_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )

    account_type: Mapped[str] = mapped_column(
        String(30),
        default="CURRENT",
        nullable=False,
    )

    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    transactions = relationship(
        "BankTransaction",
        back_populates="bank_account",
        cascade="all, delete-orphan",
    )


class BankTransaction(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    __tablename__ = "bank_transactions"

    bank_account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    bank_account = relationship(
        "BankAccount",
        back_populates="transactions",
    )

    transaction_type: Mapped[str] = mapped_column(
        String(30),  # DEPOSIT, WITHDRAWAL, INCOME, EXPENSE, TRANSFER
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    transaction_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    reference_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )

    remarks: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
