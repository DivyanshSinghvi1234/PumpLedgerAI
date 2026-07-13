from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from app.common.pagination import PaginationResponse


class VehicleBase(BaseModel):

    customer_uuid: UUID

    vehicle_number: str = Field(
        ...,
        min_length=4,
        max_length=20,
    )

    vehicle_type: str | None = Field(
        default=None,
        max_length=50,
    )


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):

    vehicle_number: str | None = Field(
        default=None,
        min_length=4,
        max_length=20,
    )

    vehicle_type: str | None = Field(
        default=None,
        max_length=50,
    )

    is_active: bool | None = None


# =====================================================
# Response
# =====================================================

class VehicleResponse(BaseModel):

    uuid: UUID

    customer_uuid: UUID

    customer_name: str

    vehicle_number: str

    vehicle_type: str | None = None

    model_config = ConfigDict(
        from_attributes=True,
    )

    @model_validator(mode="before")
    @classmethod
    def flatten_customer(cls, data: Any) -> Any:
        """
        The ORM Vehicle exposes a ``customer`` relationship, not
        ``customer_uuid`` / ``customer_name`` directly. Flatten those
        from the related Customer so the response matches the frontend.
        """
        customer = getattr(data, "customer", None)

        if customer is None:
            return data

        return {
            "uuid": data.uuid,
            "customer_uuid": customer.uuid,
            "customer_name": customer.name,
            "vehicle_number": data.vehicle_number,
            "vehicle_type": data.vehicle_type,
        }


# =====================================================
# List Response
# =====================================================

class VehicleListResponse(BaseModel):

    items: list[VehicleResponse]

    pagination: PaginationResponse

    model_config = ConfigDict(
        frozen=True,
    )
