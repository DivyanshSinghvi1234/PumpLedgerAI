from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    TimestampMixin,
    PumpScopedMixin,
)


class AuditLog(
    Base,
    IDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    """Pump-scoped audit trail. pump_id is auto-stamped on write and
    auto-filtered on read by app/database/scoping.py, so each filling
    station sees only its own trail (fail-closed if no active pump)."""
    __tablename__ = "audit_logs"

    # Override the mixin's non-nullable pump_id: audit logging is a side-effect
    # and must never roll back the business op it records. Request-scope writes
    # still get auto-stamped (correctly scoped); an out-of-request write (script,
    # test, future background job) degrades to a NULL/orphan row that no tenant's
    # filter (pump_id == <int>) can match — invisible, not leaked, not a crash.
    # ponytail: nullable is the fail-safe. Ceiling: orphan rows are un-attributed.
    # Upgrade path: if every write must carry a pump, thread pump_id explicitly
    # through log_action's ~55 call sites and restore NOT NULL.
    pump_id: Mapped[int | None] = mapped_column(
        ForeignKey("pumps.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

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
