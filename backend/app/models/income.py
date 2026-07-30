from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum as SqlEnum,
    ForeignKey,
    JSON,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import FuelType, IncomeKind, PaymentMode
from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class Income(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
    PumpScopedMixin,
):
    """A non-sale cash-in/out line for a day: a variable expense/receipt with
    a free-text description of what it was for, an amount, a payment mode, and
    an optional free-text category. ``kind`` distinguishes money coming in
    (INCOME) from money going out (EXPENSE). An expense may optionally be linked
    to a customer — used for lending: it posts a debit to that customer's ledger
    so the loan shows up as an outstanding balance."""

    __tablename__ = "incomes"

    kind: Mapped[IncomeKind] = mapped_column(
        SqlEnum(IncomeKind),
        default=IncomeKind.INCOME,
        nullable=False,
        index=True,
    )

    income_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # What this is used for (operator-entered).
    description: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # Optional grouping label. Free-text (see the categories corner-cut in the
    # frontend); nullable so it can be left blank.
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    payment_mode: Mapped[PaymentMode] = mapped_column(
        SqlEnum(PaymentMode),
        nullable=False,
    )

    bank_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    bank_account = relationship("BankAccount")


    fuel_type: Mapped[FuelType | None] = mapped_column(
        SqlEnum(FuelType),
        nullable=True,
    )

    quantity_liters: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 3),
        nullable=True,
    )

    rate_per_liter: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    is_sale: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_amount_mismatch: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    items: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Optional customer link. Set when an EXPENSE is a loan to a customer — the
    # service posts a debit adjustment to this customer's ledger so the loan
    # registers as outstanding balance. None for ordinary income/expense.
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"),
        nullable=True,
        index=True,
    )

    customer = relationship("Customer")

    def __repr__(self) -> str:
        return (
            f"<Income("
            f"date={self.income_date}, "
            f"amount={self.amount}, "
            f"category='{self.category}'"
            f")>"
        )
