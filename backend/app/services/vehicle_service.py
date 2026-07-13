from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import (
    CustomerNotFoundError,
    DuplicateVehicleNumberError,
    VehicleNotFoundError,
)
from app.models.vehicle import Vehicle
from app.repositories.customer_repository import CustomerRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleUpdate,
)


class VehicleService:

    def __init__(self):
        self.repository = VehicleRepository()
        self.customer_repository = CustomerRepository()

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

        existing = self.repository.get_by_vehicle_number(
            db,
            data.vehicle_number,
        )

        if existing:
            raise DuplicateVehicleNumberError(
                data.vehicle_number,
            )

        vehicle = Vehicle(
            customer_id=customer.id,
            vehicle_number=data.vehicle_number,
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

        return self.repository.search(
            db,
            search=search,
            page=page,
            page_size=page_size,
        )

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
            existing = self.repository.get_by_vehicle_number(
                db,
                update_data["vehicle_number"],
            )

            if existing:
                raise DuplicateVehicleNumberError(
                    update_data["vehicle_number"],
                )

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