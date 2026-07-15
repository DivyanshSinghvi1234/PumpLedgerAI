from __future__ import annotations

from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.price_schedule import PriceSchedule
from app.repositories.base_repository import BaseRepository
from app.core.enums import FuelType


class PriceScheduleRepository(BaseRepository[PriceSchedule]):

    def __init__(self):
        super().__init__(PriceSchedule)

    def get_active_rate(
        self,
        db: Session,
        fuel_type: FuelType,
        at_time: datetime,
    ) -> PriceSchedule | None:
        """
        Get the most recent price schedule rate for a fuel type that has become effective at or before at_time.
        """
        return db.scalar(
            select(PriceSchedule)
            .where(
                PriceSchedule.fuel_type == fuel_type,
                PriceSchedule.effective_from <= at_time,
                PriceSchedule.is_active == True
            )
            .order_by(PriceSchedule.effective_from.desc())
            .limit(1)
        )

    def get_unapplied_schedules(
        self,
        db: Session,
        at_time: datetime,
    ) -> list[PriceSchedule]:
        """
        Get all price schedules that should be marked as applied because their effective time has passed.
        """
        return list(
            db.scalars(
                select(PriceSchedule)
                .where(
                    PriceSchedule.effective_from <= at_time,
                    PriceSchedule.is_applied == False,
                    PriceSchedule.is_active == True
                )
            ).all()
        )

    def get_all_schedules(
        self,
        db: Session,
    ) -> list[PriceSchedule]:
        """
        Get all active price schedules ordered by effective_from descending.
        """
        return list(
            db.scalars(
                select(PriceSchedule)
                .where(PriceSchedule.is_active == True)
                .order_by(PriceSchedule.effective_from.desc())
            ).all()
        )

