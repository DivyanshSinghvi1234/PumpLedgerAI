from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.pump import Pump
from app.models.user_pump_access import UserPumpAccess
from app.repositories.base_repository import BaseRepository


class PumpRepository(BaseRepository[Pump]):

    def __init__(self):
        super().__init__(Pump)

    def get_by_code(
        self,
        db: Session,
        code: str,
    ) -> Pump | None:

        return db.scalar(
            select(Pump).where(Pump.code == code)
        )

    def get_by_name(
        self,
        db: Session,
        name: str,
    ) -> Pump | None:

        return db.scalar(
            select(Pump).where(Pump.name == name)
        )

    def list_active(
        self,
        db: Session,
    ) -> list[Pump]:

        return list(
            db.scalars(
                select(Pump)
                .where(Pump.is_active.is_(True))
                .order_by(Pump.name)
            ).all()
        )

    # -----------------------------------------------
    # User ↔ Pump access management
    # -----------------------------------------------

    def get_user_pump_ids(
        self,
        db: Session,
        user_id: int,
    ) -> list[int]:
        """Return pump IDs assigned to a user."""

        return list(
            db.scalars(
                select(UserPumpAccess.pump_id)
                .where(UserPumpAccess.user_id == user_id)
            ).all()
        )

    def get_user_pumps(
        self,
        db: Session,
        user_id: int,
    ) -> list[Pump]:
        """Return Pump objects assigned to a user."""

        pump_ids = self.get_user_pump_ids(db, user_id)

        if not pump_ids:
            return []

        return list(
            db.scalars(
                select(Pump)
                .where(Pump.id.in_(pump_ids))
                .order_by(Pump.name)
            ).all()
        )

    def set_user_pumps(
        self,
        db: Session,
        user_id: int,
        pump_ids: list[int],
    ) -> None:
        """Replace all pump assignments for a user."""

        # Remove existing assignments
        db.execute(
            delete(UserPumpAccess)
            .where(UserPumpAccess.user_id == user_id)
        )

        # Add new assignments
        for pump_id in pump_ids:
            db.add(
                UserPumpAccess(
                    user_id=user_id,
                    pump_id=pump_id,
                )
            )

        db.commit()

    def get_pumps_by_uuids(
        self,
        db: Session,
        uuids: list[str],
    ) -> list[Pump]:
        """Return pumps matching the given UUIDs."""

        return list(
            db.scalars(
                select(Pump).where(Pump.uuid.in_(uuids))
            ).all()
        )
