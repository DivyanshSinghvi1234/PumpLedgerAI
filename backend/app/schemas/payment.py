from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from app.common.pagination import PaginationResponse
from app.core.enums import PaymentMode, TallyStatus


# =====================================================
# Base
# =====================================================

class PaymentBase(BaseModel):

    customer_uuid: UUID

    amount: Decimal = Field(..., gt=0)

    payment_mode: PaymentMode

    payment_date: date

    reference_number: str | None = Field(
        default=None,
        max_length=50,
    )

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )


# =====================================================
# Create
# =====================================================

class PaymentCreate(PaymentBase):

    model_config = ConfigDict(
        extra="forbid",
    )


# =====================================================
# Voucher settlement / allocation
# =====================================================

class VoucherAllocation(BaseModel):
    """One line of a payment: how much to apply to a specific voucher."""

    voucher_uuid: UUID

    amount: Decimal = Field(..., gt=0)


class PaymentAllocationCreate(BaseModel):
    """Receive a payment and split it across a customer's vouchers."""

    customer_uuid: UUID

    amount: Decimal = Field(..., gt=0)

    payment_mode: PaymentMode

    payment_date: date

    reference_number: str | None = Field(
        default=None,
        max_length=50,
    )

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )

    allocations: list[VoucherAllocation] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class VoucherSettleRequest(BaseModel):
    """Settle a single voucher (the 'close this voucher' button)."""

    amount: Decimal = Field(..., gt=0)

    payment_mode: PaymentMode

    payment_date: date

    reference_number: str | None = Field(
        default=None,
        max_length=50,
    )

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )

    model_config = ConfigDict(extra="forbid")


# =====================================================
# Response
# =====================================================

class PaymentResponse(BaseModel):

    uuid: UUID

    customer_uuid: UUID

    customer_name: str

    amount: Decimal

    payment_mode: PaymentMode

    payment_date: date

    reference_number: str | None = None

    remarks: str | None = None

    tally_status: TallyStatus

    model_config = ConfigDict(
        from_attributes=True,
    )

    @model_validator(mode="before")
    @classmethod
    def flatten_customer(cls, data: Any) -> Any:
        """
        The ORM Payment exposes a ``customer`` relationship, not
        ``customer_uuid`` / ``customer_name`` directly. Flatten those
        from the related Customer so the response matches the frontend.
        """
        customer = getattr(data, "customer", None)

        if customer is None:
            return data

        return {
            "uuid": data.uuid,
            "customer_uuid": customer.uuid,
            "customer_name": customer.name,
            "amount": data.amount,
            "payment_mode": data.payment_mode,
            "payment_date": data.payment_date,
            "reference_number": data.reference_number,
            "remarks": data.remarks,
            "tally_status": getattr(data, "tally_status", TallyStatus.PENDING),
        }


# =====================================================
# List Response
# =====================================================

class PaymentListResponse(BaseModel):

    items: list[PaymentResponse]

    pagination: PaginationResponse

    model_config = ConfigDict(
        frozen=True,
    )


class PaymentFifoAllocateRequest(BaseModel):
    customer_uuid: UUID
    amount: Decimal = Field(..., gt=0)
    payment_mode: PaymentMode
    payment_date: date
    reference_number: str | None = Field(default=None, max_length=50)
    remarks: str | None = Field(default=None, max_length=500)
    # Optional: scope the FIFO settlement to a single vehicle's vouchers.
    vehicle_uuid: UUID | None = None
    vehicle_number: str | None = Field(default=None, max_length=50)



class CustomerOutstandingResponse(BaseModel):
    customer_uuid: UUID
    customer_name: str
    outstanding_balance: Decimal
    credit_limit: Decimal
    opening_balance: Decimal
