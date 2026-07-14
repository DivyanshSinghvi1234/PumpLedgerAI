from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import UserRole
from app.schemas.pump import PumpResponse


class LoginRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
    )

    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    uuid: str

    username: str

    full_name: str

    role: UserRole

    is_active: bool

    pump_access: list[PumpResponse] = []

    model_config = ConfigDict(
        from_attributes=True,
    )