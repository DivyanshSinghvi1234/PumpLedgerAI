from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.repositories.base_repository import BaseRepository


class VehicleRepository(BaseRepository[Vehicle]):

    def __init__(self):
        super().__init__(Vehicle)

    def get_by_uuid(
        self,
        db: Session,
        vehicle_uuid: str,
    ) -> Vehicle | None:

        return db.scalar(
            select(Vehicle).where(
                Vehicle.uuid == vehicle_uuid
            )
        )

    def get_by_vehicle_number(
        self,
        db: Session,
        vehicle_number: str,
    ) -> Vehicle | None:

        return db.scalar(
            select(Vehicle).where(
                Vehicle.vehicle_number == vehicle_number
            )
        )

    def get_by_normalized(
        self,
        db: Session,
        normalized_number: str,
    ) -> Vehicle | None:
        """Match an existing active vehicle by its canonical plate so
        ``MP09 CD 1234`` / ``mp-09-cd-1234`` / ``MP09CD1234`` all resolve to
        one record. See ``app.common.normalization``."""

        return db.scalar(
            select(Vehicle)
            .where(
                Vehicle.is_active.is_(True),
                Vehicle.normalized_number == normalized_number,
            )
            .order_by(Vehicle.id)
        )

    def get_all(
        self,
        db: Session,
    ) -> list[Vehicle]:

        return list(
            db.scalars(
                select(Vehicle).order_by(
                    Vehicle.vehicle_number
                )
            ).all()
        )

    # -----------------------------------
    # Search + Pagination
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Vehicle], int]:

        # Join to Customer so we can both search by customer name and
        # eager-load it for the embedded customer_name/customer_uuid.
        query = (
            select(Vehicle)
            .join(Vehicle.customer)
            .where(Vehicle.is_active.is_(True))
        )

        if search:

            pattern = f"%{search}%"

            query = query.where(
                or_(
                    Vehicle.vehicle_number.ilike(pattern),
                    Vehicle.vehicle_type.ilike(pattern),
                    Customer.name.ilike(pattern),
                )
            )

        total = db.scalar(
            select(func.count()).select_from(
                query.subquery()
            )
        )

        query = query.options(joinedload(Vehicle.customer))

        query = (
            query
            .order_by(Vehicle.vehicle_number)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        vehicles = list(
            db.scalars(query).all()
        )

        return vehicles, total or 0