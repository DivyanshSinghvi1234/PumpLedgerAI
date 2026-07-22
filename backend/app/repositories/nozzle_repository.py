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

    def get_all(self, db: Session) -> list[FuelDispenser]:
        """
        Retrieve all fuel dispensers and eagerly load their related nozzles in a single query.
        
        Warning: If pagination (LIMIT/OFFSET) is ever added to this query, joinedload on
        a collection relationship (one-to-many) will cause incorrect pagination counts in SQL
        (as the LIMIT is applied to the joined cartesian result set). In that case, refactor
        to use selectinload() or split the retrieval into separate queries.
        """
        from sqlalchemy.orm import joinedload
        return list(
            db.scalars(
                select(FuelDispenser)
                .options(joinedload(FuelDispenser.nozzles))
            ).unique().all()
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

    def get_all_ordered(self, db: Session) -> list[NozzleReading]:
        from sqlalchemy import desc
        return list(
            db.scalars(
                select(NozzleReading).order_by(desc(NozzleReading.reading_date))
            ).all()
        )
