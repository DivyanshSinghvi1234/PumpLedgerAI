from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import FuelType, PaymentMode


class VoucherSuggestRequest(BaseModel):
    vehicle_number: str | None = None
    customer_uuid: UUID | None = None
    customer_name: str | None = None
    fuel_type: FuelType | None = None
    quantity_liters: Decimal | None = None
    rate_per_liter: Decimal | None = None
    total_amount: Decimal | None = None
    invoice_date: date | None = None
    exclude_voucher_uuid: UUID | None = None


class FuzzyCustomerCandidate(BaseModel):
    customer_uuid: str
    customer_name: str
    customer_code: str | None = None
    mobile: str | None = None
    score: float


class SuggestionWarning(BaseModel):
    type: Literal[
        "UNUSUAL_QUANTITY",
        "POSSIBLE_DUPLICATE",
        "FUZZY_CUSTOMER_MATCH",
        "CREDIT_LIMIT_EXCEEDED",
    ]
    message: str
    duplicate_uuid: str | None = None
    duplicate_invoice_number: str | None = None
    candidates: list[FuzzyCustomerCandidate] = Field(default_factory=list)


class VoucherSuggestionResponse(BaseModel):
    normalized_vehicle_number: str | None = None
    vehicle_uuid: str | None = None
    customer_uuid: str | None = None
    customer_name: str | None = None
    customer_confidence: float = 0.0
    fuel_type: FuelType | None = None
    fuel_type_confidence: float = 0.0
    rate_per_liter: Decimal | None = None
    payment_mode: PaymentMode | None = None
    payment_mode_confidence: float = 0.0
    vehicle_avg_quantity: float | None = None
    vehicle_sample_count: int = 0
    customer_credit_limit: Decimal | None = None
    customer_outstanding_balance: Decimal | None = None
    warnings: list[SuggestionWarning] = Field(default_factory=list)
