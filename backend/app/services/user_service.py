from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.core.exceptions import (
    DuplicateUsernameError,
    InvalidPasswordError,
    UserNotFoundError,
)
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.pump import PumpResponse
from app.schemas.user import UserCreate, UserUpdate
from app.services.pump_service import PumpService


class UserService:

    def __init__(self):
        self.repository = UserRepository()
        self.pump_service = PumpService()

    def _build_pump_access(
        self,
        db: Session,
        user: User,
    ) -> list[PumpResponse]:
        """Build the pump_access list for a user response."""
        pumps = self.pump_service.get_user_pumps(db, user)
        return [
            PumpResponse.model_validate(p)
            for p in pumps
        ]

    def _enrich_with_pumps(
        self,
        db: Session,
        user: User,
    ) -> User:
        """Attach pump_access as a transient attribute for serialisation.

        We bypass SQLAlchemy's instrumented attribute setter by writing
        directly to the instance __dict__ so the Pydantic-serialisable
        list doesn't collide with the ORM relationship.
        """
        user.__dict__["pump_access"] = self._build_pump_access(db, user)
        return user

    def create(
        self,
        db: Session,
        data: UserCreate,
    ) -> User:

        existing = self.repository.get_by_username(
            db,
            data.username,
        )

        if existing:
            raise DuplicateUsernameError(data.username)

        user = User(
            username=data.username,
            full_name=data.full_name,
            password_hash=hash_password(data.password),
            role=data.role,
            is_active=True,
        )

        user = self.repository.create(db, user)

        # Assign pumps
        if data.role == UserRole.ADMIN:
            # Admin auto-gets all pumps
            all_pumps = self.pump_service.list_all(db)
            pump_uuids = [p.uuid for p in all_pumps]
            if pump_uuids:
                self.pump_service.set_user_pumps(db, user, pump_uuids)
        elif data.pump_uuids:
            self.pump_service.set_user_pumps(db, user, data.pump_uuids)

        return self._enrich_with_pumps(db, user)

    def list_all(
        self,
        db: Session,
    ) -> list[User]:

        users = self.repository.list_all(db)
        for u in users:
            self._enrich_with_pumps(db, u)
        return users

    def get_by_uuid(
        self,
        db: Session,
        user_uuid: str,
    ) -> User:

        user = self.repository.get_by_uuid(db, user_uuid)

        if user is None:
            raise UserNotFoundError(user_uuid)

        return self._enrich_with_pumps(db, user)

    def update(
        self,
        db: Session,
        user_uuid: str,
        data: UserUpdate,
    ) -> User:

        user = self.repository.get_by_uuid(db, user_uuid)

        if user is None:
            raise UserNotFoundError(user_uuid)

        update_data = data.model_dump(exclude_unset=True)
        pump_uuids = update_data.pop("pump_uuids", None)

        for field, value in update_data.items():
            setattr(user, field, value)

        user = self.repository.update(db, user)

        # Update pump assignments if provided
        if pump_uuids is not None:
            self.pump_service.set_user_pumps(db, user, pump_uuids)

        return self._enrich_with_pumps(db, user)

    def deactivate(
        self,
        db: Session,
        user_uuid: str,
    ) -> User:

        user = self.repository.get_by_uuid(db, user_uuid)

        if user is None:
            raise UserNotFoundError(user_uuid)

        user.is_active = False

        user = self.repository.update(db, user)
        return self._enrich_with_pumps(db, user)

    def change_password(
        self,
        db: Session,
        user: User,
        current_password: str,
        new_password: str,
    ) -> None:

        if not verify_password(current_password, user.password_hash):
            raise InvalidPasswordError()

        user.password_hash = hash_password(new_password)

        self.repository.update(db, user)

