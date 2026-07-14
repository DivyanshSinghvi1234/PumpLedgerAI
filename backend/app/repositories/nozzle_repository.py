from __future__ import annotations

from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.repositories.base_repository import BaseRepository


class NozzleRepository(BaseRepository[Nozzle]):

    def __init__(self):
        super().__init__(Nozzle)

    def get_by_name(self, db: Session, name: str) -> Nozzle | None:
        return db.scalar(
            select(Nozzle).where(
                Nozzle.name == name,
                Nozzle.is_active == True
            )
        )


class NozzleReadingRepository(BaseRepository[NozzleReading]):

    def __init__(self):
        super().__init__(NozzleReading)

    def get_by_date(
        self,
        db: Session,
        nozzle_id: int,
        reading_date: date,
    ) -> NozzleReading | None:
        return db.scalar(
            select(NozzleReading).where(
                NozzleReading.nozzle_id == nozzle_id,
                NozzleReading.reading_date == reading_date,
            )
        )
