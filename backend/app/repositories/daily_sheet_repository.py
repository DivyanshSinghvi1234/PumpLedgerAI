from __future__ import annotations

from datetime import date
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.daily_sheet import DailySheet
from app.repositories.base_repository import BaseRepository


class DailySheetRepository(BaseRepository[DailySheet]):

    def __init__(self):
        super().__init__(DailySheet)

    def get_by_date(
        self,
        db: Session,
        date_val: date,
    ) -> DailySheet | None:
        """
        Get a daily sheet for a specific date (automatically filtered by
        pump_id via scoping).
        """
        return db.scalar(
            select(DailySheet)
            .where(
                DailySheet.date == date_val,
                DailySheet.is_active == True,
            )
        )

    def list_all(
        self,
        db: Session,
    ) -> list[DailySheet]:
        """Return all active sheets ordered newest-date first."""
        return list(
            db.scalars(
                select(DailySheet)
                .where(DailySheet.is_active == True)
                .order_by(desc(DailySheet.date), desc(DailySheet.id))
            ).all()
        )
