from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.daily_cash_sheet import DailyCashSheet
from app.repositories.daily_cash_sheet_repository import DailyCashSheetRepository
from app.schemas.daily_cash_sheet import DailyCashSheetCreate


class DailyCashSheetService:

    def __init__(self) -> None:
        self.repository = DailyCashSheetRepository()

    def get_by_date(self, db: Session, sheet_date: date) -> Optional[DailyCashSheet]:
        return self.repository.get_by_date(db, sheet_date)

    def upsert(self, db: Session, data: DailyCashSheetCreate) -> DailyCashSheet:
        existing = self.repository.get_by_date(db, data.sheet_date)
        if existing:
            existing.notes_500 = data.notes_500
            existing.notes_200 = data.notes_200
            existing.notes_100 = data.notes_100
            existing.notes_50 = data.notes_50
            existing.notes_20 = data.notes_20
            existing.notes_10 = data.notes_10
            existing.cash_sent_home = data.cash_sent_home
            existing.prev_deposit = data.prev_deposit
            existing.ledger_interest = data.ledger_interest
            existing.notes = data.notes
            return self.repository.save(db, existing)

        sheet = DailyCashSheet(
            sheet_date=data.sheet_date,
            notes_500=data.notes_500,
            notes_200=data.notes_200,
            notes_100=data.notes_100,
            notes_50=data.notes_50,
            notes_20=data.notes_20,
            notes_10=data.notes_10,
            cash_sent_home=data.cash_sent_home,
            prev_deposit=data.prev_deposit,
            ledger_interest=data.ledger_interest,
            notes=data.notes,
        )
        return self.repository.save(db, sheet)
