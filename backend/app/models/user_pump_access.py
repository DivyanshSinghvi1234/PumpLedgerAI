from __future__ import annotations

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    TimestampMixin,
)


class UserPumpAccess(
    Base,
    IDMixin,
    TimestampMixin,
):
    """Many-to-many association: which users can access which pumps."""

    __tablename__ = "user_pump_access"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "pump_id",
            name="uq_user_pump",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    pump_id: Mapped[int] = mapped_column(
        ForeignKey("pumps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    user = relationship(
        "User",
        back_populates="pump_assignments",
    )

    pump = relationship(
        "Pump",
        back_populates="user_access",
    )
