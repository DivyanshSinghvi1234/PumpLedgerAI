from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.fuel_tank import FuelTank, DipReading
from app.repositories.base_repository import BaseRepository
from app.core.enums import FuelType


class FuelTankRepository(BaseRepository[FuelTank]):

    def __init__(self):
        super().__init__(FuelTank)

    def get_by_fuel_type(
        self,
        db: Session,
        fuel_type: FuelType,
    ) -> list[FuelTank]:
        return list(
            db.scalars(
                select(FuelTank).where(
                    FuelTank.fuel_type == fuel_type,
                    FuelTank.is_active == True
                )
            ).all()
        )


class DipReadingRepository(BaseRepository[DipReading]):

    def __init__(self):
        super().__init__(DipReading)

    def get_by_date(
        self,
        db: Session,
        tank_id: int,
        reading_date,
    ) -> DipReading | None:
        return db.scalar(
            select(DipReading).where(
                DipReading.tank_id == tank_id,
                DipReading.reading_date == reading_date,
                DipReading.is_active == True
            )
        )
