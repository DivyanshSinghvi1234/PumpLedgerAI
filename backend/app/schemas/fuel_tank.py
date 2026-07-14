from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.core.enums import FuelType


class FuelTankCreate(BaseModel):
    name: str
    fuel_type: FuelType
    capacity_liters: float
    current_stock_liters: float = 0.0


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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
