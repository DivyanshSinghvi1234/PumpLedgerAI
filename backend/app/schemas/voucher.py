from __future__ import annotations

from datetime import date, datetime
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

from app.core.enums import (
    AIProvider,
    FuelType,
    PaymentMode,
    PaymentStatus,
    TallyStatus,
    VerificationStatus,
)


class VoucherBase(BaseModel):
    invoice_number: str = Field(..., min_length=1, max_length=50)
    invoice_date: date

    vehicle_number: str | None = Field(default=None, max_length=20)
    customer_name: str | None = Field(default=None, max_length=100)

    # Optional real customer link. Required for a CREDIT voucher to post
    # to the customer's ledger; free-text customer_name is kept for
    # OCR / walk-in sales with no linked account.
    customer_uuid: UUID | None = None

    fuel_type: FuelType

    quantity_liters: Decimal = Field(..., gt=0)
    rate_per_liter: Decimal = Field(..., gt=0)
    total_amount: Decimal = Field(..., gt=0)

    payment_mode: PaymentMode

    remarks: str | None = None


class VoucherCreate(VoucherBase):
    # Path to the stored invoice image, set when the voucher is created from
    # the OCR upload flow. Absent for manually-entered vouchers.
    image_path: str | None = None


class VoucherUpdate(BaseModel):
    invoice_number: str | None = None
    invoice_date: date | None = None

    vehicle_number: str | None = None
    customer_name: str | None = None

    customer_uuid: UUID | None = None

    fuel_type: FuelType | None = None

    quantity_liters: Decimal | None = None
    rate_per_liter: Decimal | None = None
    total_amount: Decimal | None = None

    payment_mode: PaymentMode | None = None

    remarks: str | None = None

    model_config = ConfigDict(extra="forbid")


class VoucherResponse(VoucherBase):
    uuid: UUID

    verification_status: VerificationStatus
    tally_status: TallyStatus

    payment_status: PaymentStatus
    amount_paid: Decimal
    balance_due: Decimal

    ai_provider: AIProvider | None
    ocr_confidence: float | None
    image_path: str | None

    is_active: bool

    # Timestamp fields — when the voucher was first saved and last modified.
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def resolve_customer_uuid(cls, data: Any) -> Any:
        """
        The ORM Voucher has ``customer_id`` and an optional ``customer``
        relationship, not ``customer_uuid``. When serializing from the ORM,
        flatten the linked customer's uuid (or None) so the field resolves.
        """
        # Only transform ORM objects (attribute access), not dicts.
        if isinstance(data, dict):
            return data

        if not hasattr(data, "invoice_number"):
            return data

        customer = getattr(data, "customer", None)

        return {
            "uuid": data.uuid,
            "invoice_number": data.invoice_number,
            "invoice_date": data.invoice_date,
            "vehicle_number": data.vehicle_number,
            "customer_name": data.customer_name,
            "customer_uuid": (
                customer.uuid if customer is not None else None
            ),
            "fuel_type": data.fuel_type,
            "quantity_liters": data.quantity_liters,
            "rate_per_liter": data.rate_per_liter,
            "total_amount": data.total_amount,
            "payment_mode": data.payment_mode,
            "remarks": data.remarks,
            "verification_status": data.verification_status,
            "tally_status": data.tally_status,
            "payment_status": data.payment_status,
            "amount_paid": data.amount_paid,
            "balance_due": data.balance_due,
            "ai_provider": data.ai_provider,
            "ocr_confidence": data.ocr_confidence,
            "image_path": data.image_path,
            "is_active": data.is_active,
            "created_at": data.created_at,
            "updated_at": data.updated_at,
        }


class VoucherListResponse(BaseModel):
    items: list[VoucherResponse]

    pagination: PaginationResponse

    model_config = ConfigDict(
        frozen=True,
    )