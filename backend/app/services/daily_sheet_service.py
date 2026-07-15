from __future__ import annotations

from datetime import date, datetime, time, timezone
from sqlalchemy.orm import Session

from app.models.daily_sheet import DailySheet
from app.repositories.daily_sheet_repository import DailySheetRepository
from app.core.exceptions import (
    DailySheetNotFoundError,
    DuplicateDailySheetError,
)


class DailySheetService:

    def __init__(self):
        self.repository = DailySheetRepository()

    def get_daily_sheet(self, db: Session, date_val: date) -> DailySheet | None:
        """Retrieve the daily sheet for a specific date."""
        return self.repository.get_by_date(db, date_val)

    def list_daily_sheets(self, db: Session) -> list[DailySheet]:
        """Return all active daily sheets, newest-date first."""
        return self.repository.list_all(db)

    def create_daily_sheet(
        self,
        db: Session,
        date_val: date,
        remarks: str | None = None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> DailySheet:
        """Create a new daily sheet for a date, ensuring uniqueness.

        If ``period_start`` / ``period_end`` are not supplied the service
        defaults to:
          • period_start = midnight (00:00:00 UTC) of ``date_val``
          • period_end   = the current UTC moment (time of generation)

        This means any voucher whose ``created_at`` falls within the window
        belongs to this sheet; vouchers saved afterward belong to the next.
        """
        existing = self.repository.get_by_date(db, date_val)
        if existing is not None:
            raise DuplicateDailySheetError(str(date_val))

        # Smart defaults when the caller does not supply a window.
        if period_start is None:
            period_start = datetime.combine(
                date_val, time.min, tzinfo=timezone.utc
            )
        if period_end is None:
            period_end = datetime.now(tz=timezone.utc)

        sheet = DailySheet(
            date=date_val,
            remarks=remarks,
            is_active=True,
            period_start=period_start,
            period_end=period_end,
        )
        return self.repository.create(db, sheet)

    def update_daily_sheet(
        self,
        db: Session,
        uuid: str,
        remarks: str | None = None,
        manual_sheet_image: str | None = None,
        date_val: date | None = None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> DailySheet:
        """Update properties of an existing daily sheet."""
        sheet = self.repository.get_by_uuid(db, uuid)
        if sheet is None or not sheet.is_active:
            raise DailySheetNotFoundError(uuid)

        if remarks is not None:
            sheet.remarks = remarks
        if manual_sheet_image is not None:
            sheet.manual_sheet_image = manual_sheet_image
        if date_val is not None:
            # Check if there is another sheet for this date
            existing = self.repository.get_by_date(db, date_val)
            if existing is not None and existing.id != sheet.id:
                raise DuplicateDailySheetError(str(date_val))
            sheet.date = date_val
        if period_start is not None:
            sheet.period_start = period_start
        if period_end is not None:
            sheet.period_end = period_end

        return self.repository.update(db, sheet)

