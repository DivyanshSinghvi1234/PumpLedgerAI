from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pump_setting import PumpSetting


class PumpSettingRepository:

    def get_by_key(self, db: Session, key: str) -> Optional[PumpSetting]:
        return db.scalar(
            select(PumpSetting).where(PumpSetting.setting_key == key)
        )

    def save(self, db: Session, setting: PumpSetting) -> PumpSetting:
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting
