from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.core.enums import FuelType


class FuelTankCreate(BaseModel):
    name: str
    fuel_type: FuelType
    capacity_liters: float
    current_stock_liters: float = 0.0


class FuelTankUpdate(BaseModel):
    name: str | None = None
    fuel_type: FuelType | None = None
    capacity_liters: float | None = None
    current_stock_liters: float | None = None
    ignore_capacity: bool = False


class FuelTankResponse(BaseModel):
    id: int
    uuid: str
    name: str
    fuel_type: FuelType
    capacity_liters: float
    current_stock_liters: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DipReadingCreate(BaseModel):
    opening_dip_liters: float
    closing_dip_liters: float
    reading_date: date | None = None


class DipReadingResponse(BaseModel):
    id: int
    uuid: str
    tank_id: int
    reading_date: date
    opening_dip_liters: float
    closing_dip_liters: float
    sales_liters_calculated: float
    actual_sales_from_vouchers: float
    variance_liters: float
    deliveries_liters: float
    nozzle_sales_liters: float
    unbilled_cash_variance: float
    physical_leak_variance: float
    variance_tolerance_liters: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TankerDeliveryCreate(BaseModel):
    tank_uuid: str
    delivery_date: date
    invoice_number: str = ""  # optional — a tanker drop doesn't always have one to hand
    quantity_liters: float
    density: float | None = None
    supplier_name: str | None = None
    remarks: str | None = None
    ignore_capacity: bool = False


class TankerDeliveryResponse(BaseModel):
    id: int
    uuid: str
    tank_id: int
    delivery_date: date
    invoice_number: str
    quantity_liters: float
    density: float | None = None
    supplier_name: str | None = None
    remarks: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
