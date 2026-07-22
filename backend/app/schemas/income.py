from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.pagination import PaginationResponse
from app.core.enums import FuelType, IncomeKind, PaymentMode


# =====================================================
# Income / expense row
# =====================================================

class IncomeBase(BaseModel):
    income_date: date

    # INCOME = money in, EXPENSE = money out. Defaults to INCOME for
    # backward compatibility with rows created before this field existed.
    kind: IncomeKind = IncomeKind.INCOME

    description: str = Field(..., min_length=1, max_length=300)

    amount: Decimal = Field(..., gt=0)

    category: str | None = Field(default=None, max_length=100)

    payment_mode: PaymentMode


class IncomeCreate(IncomeBase):
    # Optional customer link. Only meaningful for an EXPENSE that is a loan:
    # when set, the amount is posted as a debit to that customer's ledger so
    # the money lent shows up as an outstanding balance. Provide EITHER an
    # existing customer_uuid, OR a customer_name to link/auto-create by name
    # (uuid wins if both are given). See resolve_or_create_customer.
    customer_uuid: UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)

    model_config = ConfigDict(extra="forbid")


class IncomeResponse(IncomeBase):
    uuid: UUID

    # Flattened from the optional linked customer (None when unlinked).
    customer_uuid: UUID | None = None
    customer_name: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_customer(cls, data: Any) -> Any:
        """The ORM Income has a ``customer`` relationship, not
        ``customer_uuid`` / ``customer_name``. Flatten those from the related
        Customer (if any) so the response matches the frontend."""
        # Only transform ORM objects (attribute access), not dicts.
        if isinstance(data, dict):
            return data

        customer = getattr(data, "customer", None)

        return {
            "uuid": data.uuid,
            "income_date": data.income_date,
            "kind": data.kind,
            "description": data.description,
            "amount": data.amount,
            "category": data.category,
            "payment_mode": data.payment_mode,
            "customer_uuid": customer.uuid if customer else None,
            "customer_name": customer.name if customer else None,
        }


class IncomeListResponse(BaseModel):
    items: list[IncomeResponse]

    pagination: PaginationResponse

    model_config = ConfigDict(frozen=True)


# =====================================================
# Daily summary
# =====================================================

class FuelSaleRow(BaseModel):
    """One fuel type's total for the day: liters × rate = amount."""

    fuel_type: FuelType

    liters: Decimal

    rate: Decimal

    amount: Decimal


class IncomeSummaryResponse(BaseModel):
    summary_date: date

    # Per-fuel-type sales (aggregated liters, not individual readings).
    fuel_sales: list[FuelSaleRow]

    # Sale of fuel for the day (sum of fuel_sales amounts).
    total_sales: Decimal

    # Sum of the day's INCOME rows.
    total_incomes: Decimal

    # Sum of the day's EXPENSE rows.
    total_expenses: Decimal

    # Sum of the day's DEPOSIT rows.
    total_deposits: Decimal = Decimal("0.00")

    # Sum of customer payments received on this date.
    total_payments: Decimal = Decimal("0.00")

    # total_sales + total_incomes + total_payments - total_expenses - total_deposits.
    cash_in_hand: Decimal
