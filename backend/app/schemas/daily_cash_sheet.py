from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DailyCashSheetBase(BaseModel):
    sheet_date: date
    notes_500: int = Field(default=0, ge=0)
    notes_200: int = Field(default=0, ge=0)
    notes_100: int = Field(default=0, ge=0)
    notes_50: int = Field(default=0, ge=0)
    notes_20: int = Field(default=0, ge=0)
    notes_10: int = Field(default=0, ge=0)
    cash_sent_home: Decimal = Field(default=Decimal("0.00"), ge=0)
    prev_deposit: Decimal = Field(default=Decimal("0.00"), ge=0)
    ledger_interest: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: Optional[str] = None


class DailyCashSheetCreate(DailyCashSheetBase):
    pass


class DailyCashSheetResponse(DailyCashSheetBase):
    uuid: UUID

    model_config = ConfigDict(from_attributes=True)
