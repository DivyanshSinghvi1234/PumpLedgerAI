from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import (
    DuplicateUsernameError,
    InvalidPasswordError,
    UserNotFoundError,
)
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserUpdate


class UserService:

    def __init__(self):
        self.repository = UserRepository()

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

        return self.repository.create(db, user)

    def list_all(
        self,
        db: Session,
    ) -> list[User]:

        return self.repository.list_all(db)

    def get_by_uuid(
        self,
        db: Session,
        user_uuid: str,
    ) -> User:

        user = self.repository.get_by_uuid(db, user_uuid)

        if user is None:
            raise UserNotFoundError(user_uuid)

        return user

    def update(
        self,
        db: Session,
        user_uuid: str,
        data: UserUpdate,
    ) -> User:

        user = self.get_by_uuid(db, user_uuid)

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(user, field, value)

        return self.repository.update(db, user)

    def deactivate(
        self,
        db: Session,
        user_uuid: str,
    ) -> User:

        user = self.get_by_uuid(db, user_uuid)

        user.is_active = False

        return self.repository.update(db, user)

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
