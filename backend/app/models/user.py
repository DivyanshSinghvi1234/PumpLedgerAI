from datetime import datetime
from sqlalchemy import Boolean, Enum, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import UserRole
from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    TimestampMixin,
    UUIDMixin,
)


class User(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        nullable=False,
        default=UserRole.OPERATOR,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    last_active_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    pump_assignments = relationship(
        "UserPumpAccess",
        back_populates="user",
        cascade="all, delete-orphan",
    )