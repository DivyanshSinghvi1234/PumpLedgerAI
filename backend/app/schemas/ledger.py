from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.pagination import PaginationResponse
from app.core.enums import LedgerEntryType


# =====================================================
# Create (adjustments only — everything else is posted
# automatically by other services)
# =====================================================

class LedgerAdjustmentCreate(BaseModel):

    entry_type: Literal[
        LedgerEntryType.DEBIT_ADJUSTMENT,
        LedgerEntryType.CREDIT_ADJUSTMENT,
    ]

    amount: Decimal = Field(..., gt=0)

    entry_date: date

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )

    model_config = ConfigDict(
        extra="forbid",
    )


# =====================================================
# Response
# =====================================================

class LedgerEntryResponse(BaseModel):
    """
    A single ledger row enriched with its signed effect and the
    running balance after it. ``signed_amount`` and ``balance_after``
    are computed by the service (not stored on the row).
    """

    uuid: UUID

    entry_type: LedgerEntryType

    amount: Decimal

    signed_amount: Decimal

    balance_after: Decimal

    entry_date: date

    reference_type: str | None = None

    remarks: str | None = None

    image_path: str | None = None

    invoice_number: str | None = None

    status: str | None = None

    model_config = ConfigDict(
        from_attributes=True,
    )


# =====================================================
# List Response
# =====================================================

class LedgerListResponse(BaseModel):

    customer_uuid: UUID

    customer_name: str

    opening_balance: Decimal

    closing_balance: Decimal

    items: list[LedgerEntryResponse]

    pagination: PaginationResponse

    model_config = ConfigDict(
        frozen=True,
    )


class GroupedLedgerEntry(BaseModel):
    uuid: UUID
    entry_type: LedgerEntryType
    amount: Decimal
    signed_amount: Decimal
    balance_after: Decimal
    remarks: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    voucher_status: str | None = None
    invoice_number: str | None = None


class LedgerGroupResponse(BaseModel):
    date: date
    total_debit: Decimal
    total_credit: Decimal
    closing_balance: Decimal
    entries: list[GroupedLedgerEntry]


class LedgerGroupedResponse(BaseModel):
    customer_uuid: UUID
    customer_name: str
    opening_balance: Decimal
    closing_balance: Decimal
    groups: list[LedgerGroupResponse]
