from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PumpSettingBase(BaseModel):
    setting_key: str = Field(..., min_length=1, max_length=100)
    setting_value: Any


class PumpSettingCreate(PumpSettingBase):
    pass


class PumpSettingResponse(PumpSettingBase):
    uuid: UUID

    model_config = ConfigDict(from_attributes=True)
