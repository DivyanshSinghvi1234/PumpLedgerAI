from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.shift import Shift
from app.repositories.base_repository import BaseRepository


class ShiftRepository(BaseRepository[Shift]):

    def __init__(self):
        super().__init__(Shift)

    def get_active_shift(self, db: Session) -> Shift | None:
        """Retrieve the currently open shift (where end_time is not set)."""
        return db.scalar(
            select(Shift)
            .options(joinedload(Shift.employee))
            .where(
                Shift.end_time == None,
                Shift.is_active == True
            )
        )
