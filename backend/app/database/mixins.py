from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr


class IDMixin:
    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )


class UUIDMixin:
    uuid: Mapped[str] = mapped_column(
        String(36),
        default=lambda: str(uuid.uuid4()),
        unique=True,
        nullable=False,
        index=True,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ActiveMixin:
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )


class PumpScopedMixin:
    """Adds a pump_id foreign key and pump relationship to scope entries by filling station."""

    pump_id: Mapped[int] = mapped_column(
        ForeignKey("pumps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def pump(cls):
        return relationship("Pump")