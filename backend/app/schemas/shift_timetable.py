from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.employee import EmployeeResponse


class ShiftTimetableCreate(BaseModel):
    employee_uuid: str
    day_of_week: str
    start_time: str
    end_time: str


class ShiftTimetableUpdate(BaseModel):
    day_of_week: str | None = None
    start_time: str | None = None
    end_time: str | None = None


class ShiftTimetableResponse(BaseModel):
    id: int
    uuid: str
    employee: EmployeeResponse
    day_of_week: str
    start_time: str
    end_time: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
