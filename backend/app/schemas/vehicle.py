from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from decimal import Decimal

from app.common.pagination import PaginationResponse
from app.schemas.voucher import VoucherResponse


class VehicleBase(BaseModel):

    customer_uuid: UUID

    vehicle_number: str = Field(
        ...,
        min_length=1,
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
        min_length=1,
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

    # Live SUM(balance_due) for this vehicle. Defaults to 0 when the caller
    # did not attach it (e.g. create/update responses, where it's always 0).
    outstanding_balance: Decimal = Decimal("0.00")

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
        ``outstanding_balance`` is read from a transient attribute the
        service sets (falling back to 0 when absent).
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
            "outstanding_balance": getattr(
                data, "outstanding_balance", Decimal("0.00")
            ),
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


# =====================================================
# Vehicle Ledger
# =====================================================

class VehicleLedgerResponse(BaseModel):
    """A vehicle's fuel history and outstanding dues.

    The vehicle belongs to a customer whose ledger it feeds into; this view
    scopes the vouchers to the single vehicle. ``outstanding`` is the live
    SUM(balance_due) over these vouchers.
    """

    vehicle_uuid: UUID
    vehicle_number: str
    vehicle_type: str | None = None
    customer_uuid: UUID
    customer_name: str

    outstanding: Decimal
    voucher_count: int

    vouchers: list[VoucherResponse]

    model_config = ConfigDict(
        from_attributes=True,
    )
