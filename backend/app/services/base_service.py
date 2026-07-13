from __future__ import annotations

from sqlalchemy.orm import Session


class BaseService:
    def __init__(self, repository):
        self.repository = repository

    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        uuid: str,
    ):
        return self.repository.get_by_uuid(
            db,
            uuid,
        )

    # -----------------------------------

    def get_all(
        self,
        db: Session,
    ):
        return self.repository.get_all(db)

    # -----------------------------------

    def delete(
        self,
        db: Session,
        obj,
    ):
        self.repository.delete(
            db,
            obj,
        )