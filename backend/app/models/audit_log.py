from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    TimestampMixin,
)


class AuditLog(
    Base,
    IDMixin,
    TimestampMixin,
):
    __tablename__ = "audit_logs"

    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    target_table: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    target_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    changes_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
