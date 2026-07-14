from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.schemas.employee import EmployeeResponse


class ShiftStart(BaseModel):
    employee_uuid: str
    opening_cash: Decimal


class ShiftEnd(BaseModel):
    closing_cash_reported: Decimal


class ShiftResponse(BaseModel):
    id: int
    uuid: str
    employee: EmployeeResponse
    start_time: datetime
    end_time: datetime | None = None
    opening_cash: Decimal
    closing_cash_reported: Decimal | None = None
    total_sales_amount: Decimal
    cash_reconciled: bool
    variance: Decimal | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
