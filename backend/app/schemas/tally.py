from __future__ import annotations

from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.voucher import VoucherResponse
from app.schemas.payment import PaymentResponse


class TallyLedgerMappings(BaseModel):
    cash_ledger: str = Field(default="Cash")
    upi_ledger: str = Field(default="Bank (UPI)")
    card_ledger: str = Field(default="Bank (Card)")
    petrol_sales_ledger: str = Field(default="Petrol Sales")
    diesel_sales_ledger: str = Field(default="Diesel Sales")
    lubricant_sales_ledger: str = Field(default="Lubricant Sales")


class TallyVoucherTypes(BaseModel):
    sales: str = Field(default="Sales")
    receipt: str = Field(default="Receipt")


class TallyExportRequest(BaseModel):
    from_date: date | None = None
    to_date: date | None = None
    mark_as_synced: bool = Field(default=True)
    ledger_mappings: TallyLedgerMappings = Field(default_factory=TallyLedgerMappings)
    voucher_types: TallyVoucherTypes = Field(default_factory=TallyVoucherTypes)


class TallyPreviewResponse(BaseModel):
    total_vouchers: int
    total_payments: int
    total_sales_amount: Decimal
    total_receipts_amount: Decimal
    vouchers: list[VoucherResponse]
    payments: list[PaymentResponse]
    warnings: list[str] = Field(default_factory=list)


class TallyMarkSyncedRequest(BaseModel):
    voucher_uuids: list[str] = Field(default_factory=list)
    payment_uuids: list[str] = Field(default_factory=list)
