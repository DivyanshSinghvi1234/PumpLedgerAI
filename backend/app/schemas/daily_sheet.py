from __future__ import annotations

import datetime
from pydantic import BaseModel, ConfigDict


class DailySheetExpense(BaseModel):
    category: str
    description: str
    amount: float


class DailySheetPaymentModeAmounts(BaseModel):
    cash: float = 0.0
    upi: float = 0.0
    card: float = 0.0
    credit: float = 0.0


class DailySheetCreate(BaseModel):
    date: datetime.date
    remarks: str | None = None
    period_start: datetime.datetime | None = None
    period_end: datetime.datetime | None = None
    actual_cash_collected: float | None = None
    expenses: list[DailySheetExpense] | None = None
    manual_payment_mode_amounts: DailySheetPaymentModeAmounts | None = None


class DailySheetUpdate(BaseModel):
    remarks: str | None = None
    manual_sheet_image: str | None = None
    date: datetime.date | None = None
    period_start: datetime.datetime | None = None
    period_end: datetime.datetime | None = None
    actual_cash_collected: float | None = None
    expenses: list[DailySheetExpense] | None = None
    manual_payment_mode_amounts: DailySheetPaymentModeAmounts | None = None


class DailySheetResponse(BaseModel):
    id: int
    uuid: str
    date: datetime.date
    manual_sheet_image: str | None = None
    remarks: str | None = None
    period_start: datetime.datetime | None = None
    period_end: datetime.datetime | None = None
    actual_cash_collected: float | None = None
    cash_shortage_excess: float | None = None
    expenses_data: str | None = None
    manual_payment_mode_amounts_data: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ReconciliationTankRow(BaseModel):
    tank_uuid: str
    tank_name: str
    fuel_type: str
    opening_dip_liters: float
    deliveries_liters: float
    closing_dip_liters: float
    dip_sales_liters: float
    nozzle_sales_liters: float
    voucher_sales_liters: float
    unbilled_cash_variance: float
    physical_leak_variance: float
    net_stock_variance: float
    tolerance_liters: float
    requires_review: bool


class DailyReconciliationResponse(BaseModel):
    date: datetime.date
    tanks: list[ReconciliationTankRow]
    billed_amount_by_mode: dict[str, float]
    manual_payment_mode_amounts: DailySheetPaymentModeAmounts
    recorded_amount_by_mode: dict[str, float]
    total_billed_amount: float
    payments_collected: float
    credit_given: float
    gross_fuel_sales: float = 0.0
    credit_sales: float = 0.0
    digital_sales: float = 0.0
    cash_vouchers_sales: float = 0.0
    total_expenses: float = 0.0
    expected_cash_handover: float = 0.0
    actual_cash_collected: float | None = None
    cash_shortage_excess: float | None = None
    expenses: list[DailySheetExpense] = []
