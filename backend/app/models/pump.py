from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
)


class Pump(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
):
    """A physical filling station / petrol pump location."""

    __tablename__ = "pumps"

    name: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False,
    )

    code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    user_access = relationship(
        "UserPumpAccess",
        back_populates="pump",
        cascade="all, delete-orphan",
    )
