from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import UserRole


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

    model_config = ConfigDict(
        from_attributes=True,
    )