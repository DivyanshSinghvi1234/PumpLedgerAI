from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.core.enums import FuelType


class PriceScheduleCreate(BaseModel):
    fuel_type: FuelType
    rate: Decimal
    effective_from: datetime


class PriceScheduleResponse(BaseModel):
    id: int
    uuid: str
    fuel_type: FuelType
    rate: Decimal
    effective_from: datetime
    is_applied: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
