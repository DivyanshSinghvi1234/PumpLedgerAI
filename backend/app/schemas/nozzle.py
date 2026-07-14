from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.core.enums import FuelType, NozzleStatus

# Nozzle Schemas
class NozzleCreate(BaseModel):
    name: str
    fuel_type: FuelType
    last_reading: float = 0.0

class NozzleResponse(BaseModel):
    id: int
    uuid: str
    dispenser_id: int
    name: str
    fuel_type: FuelType
    last_reading: float
    status: NozzleStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Dispenser Schemas
class FuelDispenserCreate(BaseModel):
    name: str
    status: NozzleStatus = NozzleStatus.ACTIVE

class FuelDispenserResponse(BaseModel):
    id: int
    uuid: str
    name: str
    status: NozzleStatus
    nozzles: list[NozzleResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Nozzle Reading Schemas
class NozzleReadingCreate(BaseModel):
    nozzle_uuid: str
    opening_reading: float | None = None
    closing_reading: float
    reading_date: date | None = None

class NozzleReadingResponse(BaseModel):
    id: int
    uuid: str
    nozzle_id: int
    reading_date: date
    opening_reading: float
    closing_reading: float
    sales: float
    total_sales: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Bulk Entry Schemas
class BulkNozzleReadingCreate(BaseModel):
    reading_date: date
    readings: list[NozzleReadingCreate]

class BulkFormNozzleItem(BaseModel):
    nozzle_uuid: str
    nozzle_name: str
    dispenser_name: str
    fuel_type: FuelType
    opening_reading: float
    closing_reading: float | None = None
    sales: float | None = None

class BulkFormResponse(BaseModel):
    reading_date: date
    items: list[BulkFormNozzleItem]
