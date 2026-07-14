from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.price_schedule import PriceSchedule
from app.repositories.price_schedule_repository import PriceScheduleRepository
from app.core.enums import FuelType


class PriceScheduleService:

    def __init__(self):
        self.repository = PriceScheduleRepository()

    def create_schedule(
        self,
        db: Session,
        fuel_type: FuelType,
        rate: Decimal | float,
        effective_from: datetime,
    ) -> PriceSchedule:
        schedule = PriceSchedule(
            fuel_type=fuel_type,
            rate=Decimal(str(rate)),
            effective_from=effective_from,
            is_applied=False,
        )
        return self.repository.create(db, schedule)

    def get_active_rate(
        self,
        db: Session,
        fuel_type: FuelType,
        at_time: datetime | None = None,
    ) -> Decimal | None:
        """Get the active fuel rate at a specific timestamp (defaults to now)."""
        time_to_check = at_time or datetime.utcnow()
        schedule = self.repository.get_active_rate(db, fuel_type, time_to_check)
        return schedule.rate if schedule else None

    def apply_pending_schedules(self, db: Session) -> int:
        """Find and mark all schedules whose effective_from time has passed as applied."""
        now = datetime.utcnow()
        schedules = self.repository.get_unapplied_schedules(db, now)
        count = 0
        for s in schedules:
            s.is_applied = True
            self.repository.update(db, s)
            count += 1
        return count
