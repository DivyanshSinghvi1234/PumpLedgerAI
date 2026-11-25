from __future__ import annotations

from datetime import date
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import FuelType


class StockDipInput(BaseModel):
    tank_uuid: str
    physical_dip: float = Field(..., ge=0)


class StockVarianceBulkDipRequest(BaseModel):
    variance_date: date
    dips: list[StockDipInput]


class StockVarianceResponse(BaseModel):
    uuid: str
    tank_uuid: str
    tank_name: str
    fuel_type: FuelType
    capacity_liters: float
    variance_date: date
    opening_stock: float
    deliveries_received: float
    meter_sales: float
    testing_qty: float
    book_stock: float
    physical_dip: float | None = None
    variance_liters: float | None = None
    variance_percent: float | None = None
    variance_amount: float | None = None
    status: str
    threshold_percent: float

    model_config = ConfigDict(from_attributes=True)


class StockAlert(BaseModel):
    tank_uuid: str
    tank_name: str
    fuel_type: FuelType
    consecutive_critical_days: int
    latest_variance_liters: float
    latest_variance_percent: float
    message: str


class StockVarianceDailySummaryResponse(BaseModel):
    variance_date: date
    threshold_percent: float
    items: list[StockVarianceResponse]
    alerts: list[StockAlert] = Field(default_factory=list)
