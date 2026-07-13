from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):

    def __init__(self):
        super().__init__(User)

    def get_by_username(
        self,
        db: Session,
        username: str,
    ) -> User | None:

        statement = (
            select(User)
            .where(User.username == username)
        )

        return db.scalar(statement)

    def get_by_uuid(
        self,
        db: Session,
        uuid: str,
    ) -> User | None:

        statement = (
            select(User)
            .where(User.uuid == uuid)
        )

        return db.scalar(statement)

    def list_all(
        self,
        db: Session,
    ) -> list[User]:

        statement = select(User).order_by(User.username)

        return list(db.scalars(statement).all())