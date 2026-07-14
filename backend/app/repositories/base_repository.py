from __future__ import annotations

from typing import Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: type[ModelType]):
        self.model = model

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        obj: ModelType,
    ) -> ModelType:

        db.add(obj)
        db.commit()
        db.refresh(obj)

        return obj

    # -----------------------------------
    # Update
    # -----------------------------------

    def update(
        self,
        db: Session,
        obj: ModelType,
    ) -> ModelType:

        db.commit()
        db.refresh(obj)

        return obj

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        obj: ModelType,
    ) -> None:

        db.delete(obj)
        db.commit()

    # -----------------------------------
    # Get by ID
    # -----------------------------------

    def get_by_id(
        self,
        db: Session,
        id: int,
    ) -> ModelType | None:

        return db.scalar(
            select(self.model).where(
                self.model.id == id
            )
        )

    # -----------------------------------
    # Get by UUID
    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        uuid: str,
    ) -> ModelType | None:

        return db.scalar(
            select(self.model).where(
                self.model.uuid == uuid
            )
        )

    # -----------------------------------
    # Get All
    # -----------------------------------

    def get_all(
        self,
        db: Session,
    ) -> list[ModelType]:

        return list(
            db.scalars(
                select(self.model)
            ).all()
        )

    def get_all_by_pump(
        self,
        db: Session,
        pump_id: int,
    ) -> list[ModelType]:

        return list(
            db.scalars(
                select(self.model).where(self.model.pump_id == pump_id)
            ).all()
        )

    # -----------------------------------
    # Count
    # -----------------------------------

    def count(
        self,
        db: Session,
    ) -> int:

        return db.scalar(
            select(
                func.count(self.model.id)
            )
        ) or 0

    def count_by_pump(
        self,
        db: Session,
        pump_id: int,
    ) -> int:

        return db.scalar(
            select(
                func.count(self.model.id)
            ).where(self.model.pump_id == pump_id)
        ) or 0

    # -----------------------------------
    # Get by UUID and Pump
    # -----------------------------------

    def get_by_uuid_and_pump(
        self,
        db: Session,
        uuid: str,
        pump_id: int,
    ) -> ModelType | None:

        return db.scalar(
            select(self.model).where(
                self.model.uuid == uuid,
                self.model.pump_id == pump_id,
            )
        )