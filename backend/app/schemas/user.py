from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import UserRole
from app.schemas.pump import PumpResponse


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole = UserRole.OPERATOR
    pump_uuids: list[str] | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None
    pump_uuids: list[str] | None = None

    model_config = ConfigDict(extra="forbid")


class UserResponse(BaseModel):
    uuid: str
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    pump_access: list[PumpResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=100)
    new_password: str = Field(..., min_length=6, max_length=100)

