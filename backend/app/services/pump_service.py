from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.models.pump import Pump
from app.models.user import User
from app.repositories.pump_repository import PumpRepository


class PumpNotFoundError(Exception):
    def __init__(self, pump_uuid: str):
        super().__init__(f"Pump '{pump_uuid}' not found.")


class PumpAccessDeniedError(Exception):
    def __init__(self):
        super().__init__("You do not have access to this pump.")


class PumpService:

    def __init__(self):
        self.repository = PumpRepository()

    def list_all(self, db: Session) -> list[Pump]:
        """Return all active pumps."""
        return self.repository.list_active(db)

    def get_by_uuid(self, db: Session, pump_uuid: str) -> Pump:
        """Get a single pump by UUID, raising if not found."""
        pump = self.repository.get_by_uuid(db, pump_uuid)
        if pump is None:
            raise PumpNotFoundError(pump_uuid)
        return pump

    def get_user_pumps(self, db: Session, user: User) -> list[Pump]:
        """
        Return pumps the user can access.
        ADMINs get all pumps; everyone else gets their assigned pumps.
        """
        if user.role == UserRole.ADMIN:
            return self.list_all(db)

        return self.repository.get_user_pumps(db, user.id)

    def set_user_pumps(
        self,
        db: Session,
        user: User,
        pump_uuids: list[str],
    ) -> None:
        """
        Replace the pump assignments for a user.
        Resolves UUIDs to IDs and persists the association.
        """
        pumps = self.repository.get_pumps_by_uuids(db, pump_uuids)

        found_uuids = {p.uuid for p in pumps}
        missing = set(pump_uuids) - found_uuids

        if missing:
            raise PumpNotFoundError(next(iter(missing)))

        pump_ids = [p.id for p in pumps]
        self.repository.set_user_pumps(db, user.id, pump_ids)

    def validate_user_has_pump_access(
        self,
        db: Session,
        user: User,
        pump_uuid: str,
    ) -> Pump:
        """
        Verify the user has access to the specified pump.
        Returns the Pump if valid, raises otherwise.
        """
        pump = self.get_by_uuid(db, pump_uuid)

        if user.role == UserRole.ADMIN:
            return pump

        user_pump_ids = self.repository.get_user_pump_ids(db, user.id)

        if pump.id not in user_pump_ids:
            raise PumpAccessDeniedError()

        return pump
