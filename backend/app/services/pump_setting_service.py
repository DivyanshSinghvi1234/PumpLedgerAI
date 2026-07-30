from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.pump_setting import PumpSetting
from app.repositories.pump_setting_repository import PumpSettingRepository


class PumpSettingService:

    def __init__(self) -> None:
        self.repository = PumpSettingRepository()

    def get_setting(self, db: Session, key: str) -> Optional[Any]:
        setting = self.repository.get_by_key(db, key)
        return setting.setting_value if setting else None

    def upsert_setting(self, db: Session, key: str, value: Any) -> PumpSetting:
        existing = self.repository.get_by_key(db, key)
        if existing:
            existing.setting_value = value
            return self.repository.save(db, existing)

        setting = PumpSetting(
            setting_key=key,
            setting_value=value,
        )
        return self.repository.save(db, setting)
