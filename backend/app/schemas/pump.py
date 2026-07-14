from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PumpResponse(BaseModel):
    """Public representation of a Pump."""

    uuid: str
    name: str
    code: str
    address: str | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserPumpAccessUpdate(BaseModel):
    """Payload to set a user's pump access list."""

    pump_uuids: list[str] = Field(
        ...,
        min_length=1,
        description="List of pump UUIDs to grant access to.",
    )
