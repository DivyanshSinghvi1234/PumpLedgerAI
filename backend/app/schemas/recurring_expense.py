from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import PaymentMode

RecurringFrequency = Literal["DAILY", "WEEKLY", "MONTHLY"]


class RecurringExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(default="Utilities", min_length=1, max_length=100)
    amount: Decimal = Field(..., gt=0)
    frequency: RecurringFrequency = "MONTHLY"
    due_day: int | None = Field(default=None, ge=0, le=31)
    payment_mode: PaymentMode = PaymentMode.CASH
    bank_account_uuid: str | None = None
    next_due_date: date = Field(default_factory=date.today)
    notes: str | None = Field(default=None, max_length=500)


class RecurringExpenseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    amount: Decimal | None = Field(default=None, gt=0)
    frequency: RecurringFrequency | None = None
    due_day: int | None = Field(default=None, ge=0, le=31)
    payment_mode: PaymentMode | None = None
    bank_account_uuid: str | None = None
    next_due_date: date | None = None
    notes: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class RecurringExpenseResponse(BaseModel):
    uuid: UUID
    title: str
    category: str
    amount: Decimal
    frequency: str
    due_day: int | None = None
    payment_mode: PaymentMode
    bank_account_uuid: str | None = None
    next_due_date: date
    last_posted_date: date | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecurringExpensePostRequest(BaseModel):
    post_date: date | None = None
    amount_override: Decimal | None = Field(default=None, gt=0)


class RecurringExpensePostResult(BaseModel):
    recurring_uuid: UUID
    title: str
    posted_amount: Decimal
    posted_date: date
    next_due_date: date
    income_uuid: UUID


class RecurringExpenseBatchPostResponse(BaseModel):
    posted_count: int
    total_amount: Decimal
    items: list[RecurringExpensePostResult]
