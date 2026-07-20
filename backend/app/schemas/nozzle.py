from __future__ import annotations

from datetime import date, datetime, time as time_type
from pydantic import BaseModel, ConfigDict, field_validator
from app.core.enums import FuelType, NozzleStatus

# Nozzle Schemas
class NozzleCreate(BaseModel):
    name: str
    fuel_type: FuelType
    last_reading: float
    tank_uuid: str | None = None
    meter_capacity: float = 1_000_000.0

class NozzleUpdate(BaseModel):
    name: str | None = None
    fuel_type: FuelType | None = None
    last_reading: float | None = None
    tank_uuid: str | None = None
    meter_capacity: float | None = None

class NozzleResponse(BaseModel):
    id: int
    uuid: str
    dispenser_id: int
    name: str
    fuel_type: FuelType
    last_reading: float
    tank_id: int | None = None
    meter_capacity: float
    status: NozzleStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Dispenser Schemas
class FuelDispenserCreate(BaseModel):
    name: str
    status: NozzleStatus = NozzleStatus.ACTIVE

class FuelDispenserUpdate(BaseModel):
    name: str | None = None
    status: NozzleStatus | None = None

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
    opening_time: str | None = "19:30"   # HH:MM local time, default 19:30
    closing_time: str | None = "19:30"   # HH:MM local time, default 19:30
    interim_6am_reading: float | None = None  # Optional meter reading at 6:00 AM

class NozzleReadingResponse(BaseModel):
    id: int
    uuid: str
    nozzle_id: int
    reading_date: date
    opening_reading: float
    closing_reading: float
    opening_time: str | None = None
    closing_time: str | None = None
    interim_6am_reading: float | None = None
    sales: float
    total_sales: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    # The DB stores these as `time` columns, but the API contract is a
    # "HH:MM" string. Coerce here so returning raw ORM objects (e.g. from the
    # bulk-save endpoint) doesn't blow up response validation.
    @field_validator("opening_time", "closing_time", mode="before")
    @classmethod
    def _time_to_str(cls, v):
        if v is None or isinstance(v, str):
            return v
        if isinstance(v, (time_type, datetime)):
            return v.strftime("%H:%M")
        return v

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
    opening_time: str | None = "19:30"
    closing_time: str | None = "19:30"
    interim_6am_reading: float | None = None

class BulkFormResponse(BaseModel):
    reading_date: date
    items: list[BulkFormNozzleItem]
