from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DayClosingNozzleLine(BaseModel):
    nozzle_uuid: str
    nozzle_name: str
    fuel_type: str
    opening_reading: float
    closing_reading: float | None = None
    interim_6am_reading: float | None = None
    testing_liters: float = 0.0
    sales_liters: float = 0.0
    rate: Decimal = Decimal("0.00")
    amount: Decimal = Decimal("0.00")
    missing_reading: bool = False


class DayClosingWarning(BaseModel):
    type: str
    severity: str  # WARNING | ERROR | INFO
    message: str


class DayClosingTankDipPreview(BaseModel):
    tank_uuid: str
    tank_name: str
    fuel_type: str
    capacity_liters: float
    book_stock: float
    physical_dip: float | None = None
    variance_liters: float | None = None
    status: str


class DayClosingDraftResponse(BaseModel):
    closing_date: date
    already_closed: bool = False
    existing_closing_uuid: str | None = None
    gross_meter_sales: Decimal
    cash_sales: Decimal
    upi_sales: Decimal
    card_sales: Decimal
    bank_sales: Decimal
    credit_sales: Decimal
    total_voucher_sales: Decimal
    upi_count: int = 0
    card_count: int = 0
    credit_count: int = 0
    cash_expenses: Decimal
    opening_float: Decimal
    nozzle_lines: list[DayClosingNozzleLine]
    tank_dips: list[DayClosingTankDipPreview]
    warnings: list[DayClosingWarning]


class DayClosingCreate(BaseModel):
    closing_date: date
    opening_float: Decimal | None = None
    physical_cash_counted: Decimal | None = Field(default=None, ge=0)
    cash_to_next_day: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes_500: int = Field(default=0, ge=0)
    notes_200: int = Field(default=0, ge=0)
    notes_100: int = Field(default=0, ge=0)
    notes_50: int = Field(default=0, ge=0)
    notes_20: int = Field(default=0, ge=0)
    notes_10: int = Field(default=0, ge=0)
    coins: Decimal = Field(default=Decimal("0.00"), ge=0)
    tank_dips: dict[str, float] = Field(default_factory=dict)
    settlement_bank_account_uuid: str | None = None
    cash_deposited_to_bank: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: str | None = Field(default=None, max_length=500)


class DayClosingResponse(BaseModel):
    uuid: UUID
    closing_date: date
    status: str
    gross_meter_sales: Decimal
    cash_sales: Decimal
    upi_sales: Decimal
    card_sales: Decimal
    bank_sales: Decimal
    credit_sales: Decimal
    total_voucher_sales: Decimal
    cash_expenses: Decimal
    opening_float: Decimal
    physical_cash_counted: Decimal
    cash_to_next_day: Decimal
    expected_cash: Decimal
    variance: Decimal
    notes_500: int
    notes_200: int
    notes_100: int
    notes_50: int
    notes_20: int
    notes_10: int
    coins: Decimal
    warnings: list[DayClosingWarning] | None = None
    closed_at: datetime | None = None
    nozzle_snapshot: list[DayClosingNozzleLine] | None = None
    settlement_bank_account_uuid: str | None = None
    cash_deposited_to_bank: Decimal = Decimal("0.00")
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)
