from __future__ import annotations

from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.fuel_dispenser import FuelDispenser
from app.repositories.base_repository import BaseRepository


class FuelDispenserRepository(BaseRepository[FuelDispenser]):

    def __init__(self):
        super().__init__(FuelDispenser)

    def get_by_name(self, db: Session, name: str) -> FuelDispenser | None:
        return db.scalar(
            select(FuelDispenser).where(
                FuelDispenser.name == name,
                FuelDispenser.is_active == True
            )
        )


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

    def get_by_name_and_dispenser(self, db: Session, name: str, dispenser_id: int) -> Nozzle | None:
        return db.scalar(
            select(Nozzle).where(
                Nozzle.name == name,
                Nozzle.dispenser_id == dispenser_id,
                Nozzle.is_active == True
            )
        )

    def get_by_dispenser(self, db: Session, dispenser_id: int) -> list[Nozzle]:
        return list(
            db.scalars(
                select(Nozzle).where(
                    Nozzle.dispenser_id == dispenser_id,
                    Nozzle.is_active == True
                )
            ).all()
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
