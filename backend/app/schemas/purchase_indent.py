from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.core.enums import FuelType
from app.models.purchase_indent import OMCCompany, IndentStatus


class PurchaseIndentCreate(BaseModel):
    omc_company: OMCCompany = OMCCompany.IOCL
    terminal_name: str
    fuel_type: FuelType
    ordered_liters: float
    expected_delivery_date: date
    procurement_cost_per_liter: float | None = None
    remarks: str | None = None


class PurchaseIndentStatusUpdate(BaseModel):
    status: IndentStatus
    tank_truck_number: str | None = None
    actual_delivery_date: date | None = None
    decanted_tank_uuid: str | None = None
    density_at_15c: float | None = None
    invoice_number: str | None = None
    total_invoice_amount: float | None = None
    remarks: str | None = None


class PurchaseIndentResponse(BaseModel):
    id: int
    uuid: str
    indent_number: str
    omc_company: OMCCompany
    terminal_name: str
    fuel_type: FuelType
    ordered_liters: float
    tank_truck_number: str | None = None
    expected_delivery_date: date
    actual_delivery_date: date | None = None
    status: IndentStatus
    decanted_tank_id: int | None = None
    decanted_tank_name: str | None = None
    density_at_15c: float | None = None
    procurement_cost_per_liter: float | None = None
    total_invoice_amount: float | None = None
    invoice_number: str | None = None
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
