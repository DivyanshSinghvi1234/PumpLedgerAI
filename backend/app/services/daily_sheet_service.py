from __future__ import annotations

import json
from datetime import date, datetime, time, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.daily_sheet import DailySheet
from app.models.fuel_tank import FuelTank, DipReading
from app.models.voucher import Voucher
from app.models.payment import Payment
from app.core.enums import PaymentMode
from app.repositories.daily_sheet_repository import DailySheetRepository
from app.services.audit_log_service import AuditLogService
from app.core.exceptions import (
    DailySheetNotFoundError,
    DuplicateDailySheetError,
)


class DailySheetService:

    def __init__(self):
        self.repository = DailySheetRepository()
        self.audit_service = AuditLogService()

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
        actual_cash_collected: float | None = None,
        expenses: list[dict] | None = None,
        manual_payment_mode_amounts: dict | None = None,
        actor_id: int | None = None,
    ) -> DailySheet:
        """Create a new daily sheet for a date, ensuring uniqueness."""
        existing = self.repository.get_by_date(db, date_val)
        if existing is not None:
            raise DuplicateDailySheetError(str(date_val))

        if period_start is None:
            period_start = datetime.combine(
                date_val, time.min, tzinfo=timezone.utc
            )
        if period_end is None:
            period_end = datetime.now(tz=timezone.utc)

        expenses_str = json.dumps(expenses) if expenses is not None else None

        sheet = DailySheet(
            date=date_val,
            remarks=remarks,
            is_active=True,
            period_start=period_start,
            period_end=period_end,
            actual_cash_collected=actual_cash_collected,
            expenses_data=expenses_str,
            manual_payment_mode_amounts_data=(
                json.dumps(manual_payment_mode_amounts)
                if manual_payment_mode_amounts is not None
                else None
            ),
        )
        sheet = self.repository.create(db, sheet)

        self.audit_service.log_action(
            db,
            action="Generated Daily Sheet",
            target_table="daily_sheets",
            target_id=str(sheet.id),
            actor_id=actor_id,
            new_values={
                "date": str(date_val),
                "remarks": remarks,
            }
        )
        return sheet

    def update_daily_sheet(
        self,
        db: Session,
        uuid: str,
        remarks: str | None = None,
        manual_sheet_image: str | None = None,
        date_val: date | None = None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        actual_cash_collected: float | None = None,
        expenses: list[dict] | None = None,
        manual_payment_mode_amounts: dict | None = None,
        actor_id: int | None = None,
    ) -> DailySheet:
        """Update properties of an existing daily sheet."""
        sheet = self.repository.get_by_uuid(db, uuid)
        if sheet is None or not sheet.is_active:
            raise DailySheetNotFoundError(uuid)

        old_values = {
            "remarks": sheet.remarks,
            "manual_sheet_image": sheet.manual_sheet_image,
            "date": str(sheet.date),
        }

        if remarks is not None:
            sheet.remarks = remarks
        if manual_sheet_image is not None:
            sheet.manual_sheet_image = manual_sheet_image
        if date_val is not None:
            existing = self.repository.get_by_date(db, date_val)
            if existing is not None and existing.id != sheet.id:
                raise DuplicateDailySheetError(str(date_val))
            sheet.date = date_val
        if period_start is not None:
            sheet.period_start = period_start
        if period_end is not None:
            sheet.period_end = period_end
        if actual_cash_collected is not None:
            sheet.actual_cash_collected = actual_cash_collected
        if expenses is not None:
            sheet.expenses_data = json.dumps(expenses)
        if manual_payment_mode_amounts is not None:
            sheet.manual_payment_mode_amounts_data = json.dumps(manual_payment_mode_amounts)

        # Compute shortage / excess if actual cash is set
        if sheet.actual_cash_collected is not None:
            reconciliation = self.get_daily_reconciliation_summary(db, sheet.date)
            expected = reconciliation.get("expected_cash_handover", 0.0)
            sheet.cash_shortage_excess = sheet.actual_cash_collected - expected

        sheet = self.repository.update(db, sheet)

        self.audit_service.log_action(
            db,
            action="Updated Daily Sheet",
            target_table="daily_sheets",
            target_id=str(sheet.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values={
                "remarks": sheet.remarks,
                "manual_sheet_image": sheet.manual_sheet_image,
                "date": str(sheet.date),
                "actual_cash_collected": sheet.actual_cash_collected,
            }
        )
        return sheet

    def get_daily_reconciliation_summary(self, db: Session, date_val: date) -> dict:
        """Owner-facing, comprehensive daily sheet reconciliation and shortage/excess summary."""
        rows = []
        for tank in db.scalars(select(FuelTank).where(FuelTank.is_active == True)).all():
            dip = db.scalar(select(DipReading).where(DipReading.tank_id == tank.id, DipReading.reading_date == date_val, DipReading.is_active == True))
            if not dip:
                continue
            tolerance = dip.variance_tolerance_liters
            rows.append({
                "tank_uuid": tank.uuid,
                "tank_name": tank.name,
                "fuel_type": tank.fuel_type.value,
                "opening_dip_liters": dip.opening_dip_liters,
                "deliveries_liters": dip.deliveries_liters,
                "closing_dip_liters": dip.closing_dip_liters,
                "dip_sales_liters": dip.sales_liters_calculated,
                "nozzle_sales_liters": dip.nozzle_sales_liters,
                "voucher_sales_liters": dip.actual_sales_from_vouchers,
                "unbilled_cash_variance": dip.unbilled_cash_variance,
                "physical_leak_variance": dip.physical_leak_variance,
                "net_stock_variance": dip.variance_liters,
                "tolerance_liters": tolerance,
                "requires_review": abs(dip.unbilled_cash_variance) > tolerance or abs(dip.physical_leak_variance) > tolerance,
            })

        sheet = self.repository.get_by_date(db, date_val)
        expenses_list = []
        manual_amounts = {"cash": 0.0, "upi": 0.0, "card": 0.0, "credit": 0.0}
        actual_cash = None
        shortage_excess = None

        if sheet:
            actual_cash = sheet.actual_cash_collected
            shortage_excess = sheet.cash_shortage_excess
            if sheet.expenses_data:
                try:
                    expenses_list = json.loads(sheet.expenses_data)
                except Exception:
                    expenses_list = []
            if sheet.manual_payment_mode_amounts_data:
                try:
                    stored_amounts = json.loads(sheet.manual_payment_mode_amounts_data)
                    manual_amounts = {
                        key: float(stored_amounts.get(key, 0) or 0)
                        for key in manual_amounts
                    }
                except (TypeError, ValueError, json.JSONDecodeError):
                    pass

        # total_expenses counts only expense-type rows (income excluded).
        # Legacy rows have no "type" and default to expense.
        total_expenses = sum(
            float(e.get("amount", 0))
            for e in expenses_list
            if e.get("type", "expense") == "expense"
        )

        # Net effect of expense/income rows on each payment mode: income adds,
        # expense subtracts. Legacy rows (no payment_mode) default to cash.
        expense_net_by_mode = {"cash": 0.0, "upi": 0.0, "card": 0.0, "credit": 0.0}
        for e in expenses_list:
            mode_key = e.get("payment_mode", "cash")
            if mode_key not in expense_net_by_mode:
                mode_key = "cash"
            amt = float(e.get("amount", 0))
            expense_net_by_mode[mode_key] += amt if e.get("type", "expense") == "income" else -amt

        billed_by_mode = {mode.value: float(db.scalar(select(func.sum(Voucher.total_amount)).where(Voucher.invoice_date == date_val, Voucher.payment_mode == mode, Voucher.is_active == True)) or 0) for mode in PaymentMode}
        total_billed = sum(billed_by_mode.values())
        credit_sales = billed_by_mode.get(PaymentMode.CREDIT.value, 0.0)
        digital_sales = billed_by_mode.get(PaymentMode.CARD.value, 0.0) + billed_by_mode.get(PaymentMode.UPI.value, 0.0)
        cash_vouchers_sales = billed_by_mode.get(PaymentMode.CASH.value, 0.0)
        # recorded_amount_by_mode stays PURE recorded sales (voucher + manual).
        # The frontend holds the live expenses list and applies income/expense per
        # mode itself (expense_net_by_mode), so per-mode display totals stay correct
        # even while a saved sheet is being edited before re-save.
        recorded_by_mode = {
            PaymentMode.CASH.value: cash_vouchers_sales + manual_amounts["cash"],
            PaymentMode.UPI.value: billed_by_mode.get(PaymentMode.UPI.value, 0.0) + manual_amounts["upi"],
            PaymentMode.CARD.value: billed_by_mode.get(PaymentMode.CARD.value, 0.0) + manual_amounts["card"],
            PaymentMode.CREDIT.value: credit_sales + manual_amounts["credit"],
        }
        # For the cash-handover formula, credit/digital are money NOT in the cash
        # drawer — voucher + manual only. Expense/income in those modes hit their
        # own bank/credit bucket, not physical cash, so they're excluded here and
        # the cash-mode net is applied separately below.
        credit_sales = credit_sales + manual_amounts["credit"]
        digital_sales = digital_sales + manual_amounts["upi"] + manual_amounts["card"]

        # Calculate gross fuel sales from nozzle readings if present
        from app.models.nozzle_reading import NozzleReading
        from app.services.price_schedule_service import PriceScheduleService
        from datetime import time, timedelta
        
        price_service = PriceScheduleService()
        nozzle_readings = db.scalars(
            select(NozzleReading)
            .where(NozzleReading.reading_date == date_val)
        ).all()
        
        nozzle_sales_amount = 0.0
        if nozzle_readings:
            # 6:00 AM IST = 00:30 UTC — the daily price revision time
            rate_at_today_6am = datetime.combine(date_val, time(0, 30), tzinfo=timezone.utc)
            rate_at_yesterday_6am = datetime.combine(date_val - timedelta(days=1), time(0, 30), tzinfo=timezone.utc)

            for nr in nozzle_readings:
                nozzle = nr.nozzle
                if not nozzle:
                    continue

                if nr.interim_6am_reading is not None:
                    # Accurate split using actual 6:00 AM meter reading
                    # Sales before 6 AM → yesterday's rate
                    # Sales after 6 AM → today's rate
                    sales_before = nr.interim_6am_reading - nr.opening_reading
                    sales_after = nr.closing_reading - nr.interim_6am_reading

                    # Handle meter rollover edge cases
                    if sales_before < 0:
                        sales_before = 0
                    if sales_after < 0:
                        sales_after = 0

                    rate_before = price_service.get_active_rate(db, nozzle.fuel_type, rate_at_yesterday_6am)
                    rate_after = price_service.get_active_rate(db, nozzle.fuel_type, rate_at_today_6am)

                    if rate_before is None:
                        rate_before = rate_after
                    if rate_after is None:
                        rate_after = rate_before

                    if rate_before is not None:
                        nozzle_sales_amount += sales_before * float(rate_before)
                    if rate_after is not None:
                        nozzle_sales_amount += sales_after * float(rate_after)
                else:
                    # No interim reading — use single 6:00 AM rate for the full shift volume
                    rate = price_service.get_active_rate(db, nozzle.fuel_type, rate_at_today_6am)
                    if rate is not None:
                        nozzle_sales_amount += float(nr.sales) * float(rate)

            gross_fuel_sales = nozzle_sales_amount
        else:
            gross_fuel_sales = total_billed

        # Only cash-mode entries move the physical drawer: subtract cash expenses,
        # add cash income (expense_net_by_mode["cash"] is +income − expense).
        # Legacy rows default to cash mode, preserving prior behaviour where every
        # expense reduced the cash handover.
        expected_cash_handover = (
            gross_fuel_sales - credit_sales - digital_sales + expense_net_by_mode["cash"]
        )

        if actual_cash is not None:
            shortage_excess = actual_cash - expected_cash_handover

        return {
            "date": date_val,
            "tanks": rows,
            "billed_amount_by_mode": billed_by_mode,
            "manual_payment_mode_amounts": manual_amounts,
            "recorded_amount_by_mode": recorded_by_mode,
            "total_billed_amount": total_billed,
            "payments_collected": float(db.scalar(select(func.sum(Payment.amount)).where(Payment.payment_date == date_val, Payment.is_active == True)) or 0),
            "credit_given": credit_sales,
            "gross_fuel_sales": gross_fuel_sales,
            "credit_sales": credit_sales,
            "digital_sales": digital_sales,
            "cash_vouchers_sales": cash_vouchers_sales,
            "total_expenses": total_expenses,
            "expected_cash_handover": expected_cash_handover,
            "actual_cash_collected": actual_cash,
            "cash_shortage_excess": shortage_excess,
            "expenses": expenses_list,
        }
