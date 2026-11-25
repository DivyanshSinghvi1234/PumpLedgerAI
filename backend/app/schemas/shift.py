from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.employee import EmployeeResponse


class ShiftStart(BaseModel):
    employee_uuid: str
    opening_cash: Decimal


class ShiftEnd(BaseModel):
    closing_cash_reported: Decimal


class ShiftResponse(BaseModel):
    id: int
    uuid: str
    employee: EmployeeResponse
    start_time: datetime
    end_time: datetime | None = None
    opening_cash: Decimal
    closing_cash_reported: Decimal | None = None
    total_sales_amount: Decimal
    cash_reconciled: bool
    variance: Decimal | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SettlementNozzleLine(BaseModel):
    nozzle_uuid: str | None = None
    nozzle_name: str
    fuel_type: str
    opening_reading: float = Field(..., ge=0)
    interim_6am_reading: float | None = Field(default=None, ge=0)
    closing_reading: float = Field(..., ge=0)
    testing_liters: float = Field(default=0.0, ge=0)
    old_rate: Decimal = Field(..., ge=0)
    new_rate: Decimal | None = Field(default=None, ge=0)


class ShiftSettlementCreate(BaseModel):
    settlement_date: date = Field(default_factory=date.today)
    shift_label: Literal["DAY_SHIFT", "NIGHT_SHIFT"] = "DAY_SHIFT"
    attendant_names: str | None = Field(default=None, max_length=300)
    responsible_employee_uuid: str | None = None

    opening_float: Decimal = Field(default=Decimal("0.00"), ge=0)
    nozzle_lines: list[SettlementNozzleLine] = Field(default_factory=list)
    manual_gross_sales: Decimal | None = Field(default=None, ge=0)

    credit_sales_total: Decimal = Field(default=Decimal("0.00"), ge=0)
    upi_total: Decimal = Field(default=Decimal("0.00"), ge=0)
    card_edc_total: Decimal = Field(default=Decimal("0.00"), ge=0)
    omc_fleet_card_total: Decimal = Field(default=Decimal("0.00"), ge=0)
    mdr_fee_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=10)

    expenses_cash_total: Decimal = Field(default=Decimal("0.00"), ge=0)
    cash_handed_to_next_shift: Decimal = Field(default=Decimal("0.00"), ge=0)

    notes_500: int = Field(default=0, ge=0)
    notes_200: int = Field(default=0, ge=0)
    notes_100: int = Field(default=0, ge=0)
    notes_50: int = Field(default=0, ge=0)
    notes_20: int = Field(default=0, ge=0)
    notes_10: int = Field(default=0, ge=0)
    coins_amount: Decimal = Field(default=Decimal("0.00"), ge=0)

    charge_shortage_to_staff: bool = False
    notes: str | None = Field(default=None, max_length=500)


class ShiftSettlementResponse(BaseModel):
    uuid: str
    settlement_date: date
    shift_label: str
    attendant_names: str | None = None
    opening_float: Decimal
    gross_meter_sales: Decimal
    credit_sales_total: Decimal
    upi_total: Decimal
    card_edc_total: Decimal
    omc_fleet_card_total: Decimal
    mdr_fee_percent: Decimal
    digital_settlement_status: str
    expenses_cash_total: Decimal
    cash_handed_to_next_shift: Decimal
    expected_cash_in_hand: Decimal
    actual_cash_counted: Decimal
    variance: Decimal
    notes_500: int
    notes_200: int
    notes_100: int
    notes_50: int
    notes_20: int
    notes_10: int
    coins_amount: Decimal
    charge_shortage_to_staff: bool
    nozzle_lines: list[dict] | None = None
    notes: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SettlementNozzleDefault(BaseModel):
    nozzle_uuid: str
    nozzle_name: str
    fuel_type: str
    opening_reading: float
    active_rate: Decimal


class ShiftSettlementDefaultsResponse(BaseModel):
    settlement_date: date
    previous_handover_float: Decimal
    credit_vouchers_total: Decimal
    cash_expenses_total: Decimal
    nozzles: list[SettlementNozzleDefault]


class SettleDigitalRequest(BaseModel):
    bank_account_uuid: UUID
    settled_date: date = Field(default_factory=date.today)
