from __future__ import annotations

import datetime
from pydantic import BaseModel, ConfigDict


class DailySheetCreate(BaseModel):
    date: datetime.date
    remarks: str | None = None
    # Optional explicit time window. When omitted the service defaults to
    # period_start = midnight of `date` (UTC) and period_end = now().
    period_start: datetime.datetime | None = None
    period_end: datetime.datetime | None = None


class DailySheetUpdate(BaseModel):
    remarks: str | None = None
    manual_sheet_image: str | None = None
    date: datetime.date | None = None
    period_start: datetime.datetime | None = None
    period_end: datetime.datetime | None = None


class DailySheetResponse(BaseModel):
    id: int
    uuid: str
    date: datetime.date
    manual_sheet_image: str | None = None
    remarks: str | None = None
    # Time-window fields — null on old sheets created before this feature.
    period_start: datetime.datetime | None = None
    period_end: datetime.datetime | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
