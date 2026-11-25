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

    def get_all_active_with_customer(self, db: Session) -> list[Vehicle]:
        """Return active vehicles with customer eager-loaded for matching."""
        return list(
            db.scalars(
                select(Vehicle)
                .where(Vehicle.is_active.is_(True))
                .options(joinedload(Vehicle.customer))
            ).all()
        )

    def get_vehicle_behavior(self, db: Session, vehicle_id: int, limit: int = 20) -> dict:
        """Summarize fuel type, payment mode, and quantity stats from recent vouchers."""
        from collections import Counter
        import math
        from app.models.voucher import Voucher

        vouchers = list(
            db.scalars(
                select(Voucher)
                .where(
                    Voucher.vehicle_id == vehicle_id,
                    Voucher.is_active.is_(True),
                )
                .order_by(Voucher.invoice_date.desc(), Voucher.id.desc())
                .limit(limit)
            ).all()
        )

        if not vouchers:
            return {
                "sample_count": 0,
                "modal_fuel_type": None,
                "fuel_type_confidence": 0.0,
                "modal_payment_mode": None,
                "payment_mode_confidence": 0.0,
                "avg_quantity": None,
                "std_quantity": None,
            }

        n = len(vouchers)
        fuel_counts = Counter(v.fuel_type for v in vouchers if v.fuel_type is not None)
        mode_counts = Counter(v.payment_mode for v in vouchers if v.payment_mode is not None)

        modal_fuel, fuel_hits = fuel_counts.most_common(1)[0] if fuel_counts else (None, 0)
        modal_mode, mode_hits = mode_counts.most_common(1)[0] if mode_counts else (None, 0)

        quantities = [float(v.quantity_liters) for v in vouchers if v.quantity_liters and float(v.quantity_liters) > 0]
        avg_qty = sum(quantities) / len(quantities) if quantities else None
        std_qty = None
        if quantities and len(quantities) >= 2 and avg_qty is not None:
            variance = sum((q - avg_qty) ** 2 for q in quantities) / len(quantities)
            std_qty = math.sqrt(variance)

        return {
            "sample_count": n,
            "modal_fuel_type": modal_fuel,
            "fuel_type_confidence": round(fuel_hits / n, 2) if modal_fuel else 0.0,
            "modal_payment_mode": modal_mode,
            "payment_mode_confidence": round(mode_hits / n, 2) if modal_mode else 0.0,
            "avg_quantity": round(avg_qty, 2) if avg_qty is not None else None,
            "std_quantity": round(std_qty, 2) if std_qty is not None else None,
        }
