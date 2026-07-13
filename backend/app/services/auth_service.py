from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository


class AuthService:

    def __init__(self):
        self.repository = UserRepository()

    def authenticate(
        self,
        db: Session,
        username: str,
        password: str,
    ) -> User | None:

        user = self.repository.get_by_username(
            db,
            username,
        )

        if user is None:
            return None

        if not verify_password(
            password,
            user.password_hash,
        ):
            return None

        if not user.is_active:
            return None

        return user

    def login(
        self,
        db: Session,
        username: str,
        password: str,
    ) -> str | None:

        user = self.authenticate(
            db,
            username,
            password,
        )

        if user is None:
            return None

        return create_access_token(
            str(user.uuid),
        )