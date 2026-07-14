from __future__ import annotations

from typing import Any
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.common.pagination import PaginationResponse


OPTIONAL_TEXT_FIELDS = {
    "customer_code",
    "mobile",
    "email",
    "gst_number",
    "address",
    "city",
    "state",
    "pincode",
    "remarks",
}


def normalize_optional_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    normalized = value.strip()
    return normalized or None


# =====================================================
# Base
# =====================================================

class CustomerBase(BaseModel):
    customer_code: str | None = Field(
        default=None,
        max_length=20,
    )

    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    mobile: str | None = Field(
        default=None,
        max_length=20,
    )

    email: str | None = Field(
        default=None,
        max_length=150,
    )

    gst_number: str | None = Field(
        default=None,
        max_length=20,
    )

    address: str | None = None

    city: str | None = None

    state: str | None = None

    pincode: str | None = Field(
        default=None,
        max_length=10,
    )

    credit_limit: Decimal = Decimal("0.00")

    opening_balance: Decimal = Decimal("0.00")

    remarks: str | None = None


# =====================================================
# Create
# =====================================================

class CustomerCreate(BaseModel):
    customer_code: str | None = Field(
        default=None,
        max_length=20,
    )

    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    mobile: str | None = Field(
        default=None,
        max_length=20,
    )

    email: str | None = Field(
        default=None,
        max_length=150,
    )

    gst_number: str | None = Field(
        default=None,
        max_length=20,
    )

    address: str | None = None

    city: str | None = None

    state: str | None = None

    pincode: str | None = Field(
        default=None,
        max_length=10,
    )

    credit_limit: Decimal = Decimal("0.00")

    opening_balance: Decimal = Decimal("0.00")

    remarks: str | None = None

    @field_validator(*OPTIONAL_TEXT_FIELDS, mode="before")
    @classmethod
    def normalize_optional_text_fields(
        cls,
        value: Any,
    ) -> Any:
        return normalize_optional_text(value)

    model_config = ConfigDict(
        extra="forbid",
    )

# =====================================================
# Update
# =====================================================

class CustomerUpdate(BaseModel):
    customer_code: str | None = Field(
        default=None,
        max_length=20,
    )
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )
    mobile: str | None = Field(
        default=None,
        max_length=20,
    )
    email: str | None = Field(
        default=None,
        max_length=150,
    )
    gst_number: str | None = Field(
        default=None,
        max_length=20,
    )

    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = Field(
        default=None,
        max_length=10,
    )

    credit_limit: Decimal | None = None
    opening_balance: Decimal | None = None

    remarks: str | None = None

    is_active: bool | None = None

    @field_validator(*OPTIONAL_TEXT_FIELDS, mode="before")
    @classmethod
    def normalize_optional_text_fields(
        cls,
        value: Any,
    ) -> Any:
        return normalize_optional_text(value)

    model_config = ConfigDict(
        extra="forbid",
    )


# =====================================================
# Response
# =====================================================

class CustomerResponse(CustomerBase):
    uuid: UUID

    outstanding_balance: Decimal

    is_active: bool

    model_config = ConfigDict(
        from_attributes=True,
    )




# =====================================================
# List Response
# =====================================================

class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]

    pagination: PaginationResponse

    model_config = ConfigDict(
        frozen=True,
    )


class CustomerAutocompleteItem(BaseModel):
    uuid: UUID
    label: str  # "Name (CODE)" for display
    name: str
    customer_code: str | None = None
    mobile: str | None = None
    outstanding_balance: Decimal