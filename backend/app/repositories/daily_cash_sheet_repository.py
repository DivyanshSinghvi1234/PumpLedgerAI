from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.daily_cash_sheet import DailyCashSheet


class DailyCashSheetRepository:

    def get_by_date(self, db: Session, sheet_date: date) -> Optional[DailyCashSheet]:
        return db.scalar(
            select(DailyCashSheet).where(DailyCashSheet.sheet_date == sheet_date)
        )

    def save(self, db: Session, sheet: DailyCashSheet) -> DailyCashSheet:
        db.add(sheet)
        db.commit()
        db.refresh(sheet)
        return sheet
