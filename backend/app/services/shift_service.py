from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.shift import Shift
from app.models.voucher import Voucher
from app.models.employee import Employee
from app.repositories.shift_repository import ShiftRepository
from app.core.enums import PaymentMode


class ShiftService:

    def __init__(self):
        self.repository = ShiftRepository()

    def start_shift(
        self,
        db: Session,
        employee_uuid: str,
        opening_cash: Decimal | float,
    ) -> Shift:
        # Resolve employee
        employee = db.scalar(select(Employee).where(Employee.uuid == employee_uuid))
        if not employee:
            raise ValueError("Employee not found.")

        # Check if there is already an active shift
        active = self.repository.get_active_shift(db)
        if active:
            raise ValueError(f"Attendant '{active.employee.full_name}' already has an active shift open.")

        shift = Shift(
            employee_id=employee.id,
            opening_cash=Decimal(str(opening_cash)),
            cash_reconciled=False,
        )
        return self.repository.create(db, shift)

    def get_active_shift(self, db: Session) -> Shift | None:
        return self.repository.get_active_shift(db)

    def end_shift(
        self,
        db: Session,
        closing_cash_reported: Decimal | float,
    ) -> Shift:
        # Get active shift
        shift = self.repository.get_active_shift(db)
        if not shift:
            raise ValueError("No active shift found to end.")

        end_time = datetime.utcnow()
        shift.end_time = end_time

        # 1. Query total sales during this shift (active vouchers created within start_time and end_time)
        sales_total = db.scalar(
            select(func.sum(Voucher.total_amount))
            .where(
                func.datetime(Voucher.created_at) >= func.datetime(shift.start_time),
                func.datetime(Voucher.created_at) <= func.datetime(end_time),
                Voucher.is_active == True
            )
        ) or Decimal("0.00")

        shift.total_sales_amount = sales_total

        # 2. Query expected cash (opening_cash + cash sales vouchers during this shift)
        cash_sales = db.scalar(
            select(func.sum(Voucher.total_amount))
            .where(
                func.datetime(Voucher.created_at) >= func.datetime(shift.start_time),
                func.datetime(Voucher.created_at) <= func.datetime(end_time),
                Voucher.payment_mode == PaymentMode.CASH,
                Voucher.is_active == True
            )
        ) or Decimal("0.00")

        expected_cash = shift.opening_cash + cash_sales
        reported_cash = Decimal(str(closing_cash_reported))
        shift.closing_cash_reported = reported_cash

        # 3. Variance = reported - expected
        shift.variance = reported_cash - expected_cash
        shift.cash_reconciled = True

        return self.repository.update(db, shift)
