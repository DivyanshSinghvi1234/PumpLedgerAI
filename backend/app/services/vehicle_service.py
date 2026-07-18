from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import (
    CustomerNotFoundError,
    DuplicateVehicleNumberError,
    VehicleNotFoundError,
)
from app.common.normalization import normalize_vehicle_number
from app.models.vehicle import Vehicle
from app.repositories.customer_repository import CustomerRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.repositories.voucher_repository import VoucherRepository
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleLedgerResponse,
    VehicleUpdate,
)
from app.schemas.voucher import VoucherResponse
from app.services.balance_service import BalanceService


class VehicleService:

    def __init__(self):
        self.repository = VehicleRepository()
        self.customer_repository = CustomerRepository()
        self.voucher_repository = VoucherRepository()
        self.balance_service = BalanceService()

    def ledger(
        self,
        db: Session,
        vehicle_uuid: str,
    ) -> VehicleLedgerResponse:
        """Return a vehicle's voucher history plus its live outstanding total.

        Vouchers are scoped to this vehicle only; the outstanding figure is
        SUM(balance_due) over the same rows, so it always reconciles with the
        vouchers shown.
        """
        vehicle = self.repository.get_by_uuid(db, vehicle_uuid)
        if vehicle is None:
            raise VehicleNotFoundError(vehicle_uuid)

        vouchers = self.voucher_repository.list_for_vehicle(db, vehicle.id)
        outstanding = self.balance_service.vehicle_outstanding(db, vehicle.id)

        return VehicleLedgerResponse(
            vehicle_uuid=vehicle.uuid,
            vehicle_number=vehicle.vehicle_number,
            vehicle_type=vehicle.vehicle_type,
            customer_uuid=vehicle.customer.uuid,
            customer_name=vehicle.customer.name,
            outstanding=outstanding,
            voucher_count=len(vouchers),
            vouchers=[VoucherResponse.model_validate(v) for v in vouchers],
        )

    def create(
        self,
        db: Session,
        data: VehicleCreate,
    ) -> Vehicle:

        customer = self.customer_repository.get_by_uuid(
            db,
            str(data.customer_uuid),
        )

        if customer is None:
            raise CustomerNotFoundError(
                str(data.customer_uuid),
            )

        normalized = normalize_vehicle_number(data.vehicle_number)

        existing = (
            self.repository.get_by_normalized(db, normalized)
            if normalized
            else None
        )

        if existing:
            raise DuplicateVehicleNumberError(
                data.vehicle_number,
            )

        vehicle = Vehicle(
            customer_id=customer.id,
            vehicle_number=data.vehicle_number,
            normalized_number=normalized,
            vehicle_type=data.vehicle_type,
        )

        return self.repository.create(
            db,
            vehicle,
        )

    def get_all(
        self,
        db: Session,
    ) -> list[Vehicle]:

        return self.repository.get_all(db)

    # -----------------------------------
    # Search
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Vehicle], int]:

        vehicles, total = self.repository.search(
            db,
            search=search,
            page=page,
            page_size=page_size,
        )

        # Attach the live per-vehicle outstanding in one grouped query so the
        # list view stays free of an N+1.
        balances = self.balance_service.vehicle_outstanding_bulk(
            db,
            [v.id for v in vehicles],
        )
        for v in vehicles:
            v.outstanding_balance = balances.get(v.id, Decimal("0.00"))

        return vehicles, total

    def get_by_uuid(
        self,
        db: Session,
        vehicle_uuid: str,
    ) -> Vehicle:

        vehicle = self.repository.get_by_uuid(
            db,
            vehicle_uuid,
        )

        if vehicle is None:
            raise VehicleNotFoundError(
                vehicle_uuid,
            )

        vehicle.outstanding_balance = self.balance_service.vehicle_outstanding(
            db,
            vehicle.id,
        )

        return vehicle

    def update(
        self,
        db: Session,
        vehicle_uuid: str,
        data: VehicleUpdate,
    ) -> Vehicle:

        vehicle = self.repository.get_by_uuid(
            db,
            vehicle_uuid,
        )

        if vehicle is None:
            raise VehicleNotFoundError(
                vehicle_uuid,
            )

        update_data = data.model_dump(
            exclude_unset=True,
        )

        if (
            "vehicle_number" in update_data
            and update_data["vehicle_number"]
            != vehicle.vehicle_number
        ):
            new_normalized = normalize_vehicle_number(
                update_data["vehicle_number"]
            )

            existing = (
                self.repository.get_by_normalized(db, new_normalized)
                if new_normalized
                else None
            )

            if existing and existing.id != vehicle.id:
                raise DuplicateVehicleNumberError(
                    update_data["vehicle_number"],
                )

            vehicle.normalized_number = new_normalized

        for field, value in update_data.items():
            setattr(
                vehicle,
                field,
                value,
            )

        return self.repository.update(
            db,
            vehicle,
        )

    def delete(
        self,
        db: Session,
        vehicle_uuid: str,
    ) -> None:

        vehicle = self.repository.get_by_uuid(
            db,
            vehicle_uuid,
        )

        if vehicle is None:
            raise VehicleNotFoundError(
                vehicle_uuid,
            )

        self.repository.delete(
            db,
            vehicle,
        )