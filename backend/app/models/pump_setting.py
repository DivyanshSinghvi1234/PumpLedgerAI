from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import IDMixin, PumpScopedMixin, TimestampMixin, UUIDMixin


class PumpSetting(Base, IDMixin, UUIDMixin, TimestampMixin, PumpScopedMixin):
    """Stores key-value configurations (e.g. Tally ledger mappings) scoped per pump."""

    __tablename__ = "pump_settings"

    setting_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    setting_value: Mapped[Any] = mapped_column(JSON, nullable=False)

    __table_args__ = (
        UniqueConstraint("pump_id", "setting_key", name="uix_pump_setting_pump_key"),
    )
