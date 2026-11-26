from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import IncomeKind, PaymentMode
from app.core.exceptions import DayClosedError
from app.models.day_closing import DayClosing
from app.models.income import Income
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.shift_settlement import ShiftSettlement
from app.models.voucher import Voucher
from app.schemas.day_closing import (
    DayClosingCreate,
    DayClosingDraftResponse,
    DayClosingNozzleLine,
    DayClosingTankDipPreview,
    DayClosingWarning,
)
from app.services.audit_log_service import AuditLogService
from app.services.price_schedule_service import PriceScheduleService
from app.services.stock_variance_service import StockVarianceService


class DayClosingService:
    """Auto-computes end-of-day meter sales, voucher breakdowns, expenses,
    opening float, cross-validation alerts, and locks the closed business day."""

    def __init__(self) -> None:
        self.price_service = PriceScheduleService()
        self.stock_service = StockVarianceService()
        self.audit_service = AuditLogService()

    @staticmethod
    def ensure_day_open(db: Session, target_date: date | None) -> None:
        """Raise DayClosedError if the business day is already closed/locked."""
        if target_date is None:
            return
        closed = db.scalar(
            select(DayClosing).where(
                DayClosing.closing_date == target_date,
                DayClosing.status.in_(["CLOSED", "LOCKED"]),
            )
        )
        if closed is not None:
            raise DayClosedError(target_date.isoformat())

    def _previous_opening_float(self, db: Session, target_date: date) -> Decimal:
        prev_closing = db.scalar(
            select(DayClosing)
            .where(DayClosing.closing_date < target_date)
            .order_by(DayClosing.closing_date.desc(), DayClosing.id.desc())
            .limit(1)
        )
        if prev_closing is not None:
            return Decimal(str(prev_closing.cash_to_next_day))

        prev_shift = db.scalar(
            select(ShiftSettlement)
            .where(ShiftSettlement.settlement_date <= target_date)
            .order_by(ShiftSettlement.settlement_date.desc(), ShiftSettlement.id.desc())
            .limit(1)
        )
        if prev_shift is not None:
            return Decimal(str(prev_shift.cash_handed_to_next_shift))

        return Decimal("0.00")

    def compute_draft(self, db: Session, target_date: date) -> DayClosingDraftResponse:
        existing = db.scalar(
            select(DayClosing).where(DayClosing.closing_date == target_date)
        )

        # 1. Nozzle readings & meter sales
        nozzles = list(
            db.scalars(
                select(Nozzle)
                .where(Nozzle.is_active.is_(True))
                .order_by(Nozzle.id.asc())
            ).all()
        )
        readings_map = {
            r.nozzle_id: r
            for r in db.scalars(
                select(NozzleReading).where(NozzleReading.reading_date == target_date)
            ).all()
        }

        end_of_day = datetime(
            target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc
        )
        before_6am = datetime(
            target_date.year, target_date.month, target_date.day, 0, 29, 0, tzinfo=timezone.utc
        )

        nozzle_lines: list[DayClosingNozzleLine] = []
        gross_meter_sales = Decimal("0.00")
        missing_nozzles: list[str] = []

        for nozzle in nozzles:
            reading = readings_map.get(nozzle.id)
            active_rate = self.price_service.get_active_rate(db, nozzle.fuel_type, end_of_day) or Decimal("0.00")
            fuel_label = nozzle.fuel_type.value if hasattr(nozzle.fuel_type, "value") else str(nozzle.fuel_type)

            if reading is None:
                missing_nozzles.append(nozzle.name)
                prev = db.scalar(
                    select(NozzleReading)
                    .where(
                        NozzleReading.nozzle_id == nozzle.id,
                        NozzleReading.reading_date < target_date,
                    )
                    .order_by(NozzleReading.reading_date.desc(), NozzleReading.id.desc())
                    .limit(1)
                )
                opening_val = float(prev.closing_reading) if prev else float(nozzle.last_reading or 0.0)
                nozzle_lines.append(
                    DayClosingNozzleLine(
                        nozzle_uuid=str(nozzle.uuid),
                        nozzle_name=nozzle.name,
                        fuel_type=fuel_label,
                        opening_reading=opening_val,
                        closing_reading=None,
                        rate=active_rate,
                        amount=Decimal("0.00"),
                        missing_reading=True,
                    )
                )
                continue

            if reading.interim_6am_reading is not None:
                old_rate = self.price_service.get_active_rate(db, nozzle.fuel_type, before_6am) or active_rate
                vol_before = max(0.0, float(reading.interim_6am_reading) - float(reading.opening_reading))
                vol_after = max(
                    0.0,
                    float(reading.closing_reading)
                    - float(reading.interim_6am_reading)
                    - float(reading.testing_liters or 0.0),
                )
                line_amt = (
                    Decimal(str(vol_before)) * old_rate + Decimal(str(vol_after)) * active_rate
                ).quantize(Decimal("0.01"))
            else:
                line_amt = (Decimal(str(reading.sales)) * active_rate).quantize(Decimal("0.01"))

            gross_meter_sales += line_amt
            nozzle_lines.append(
                DayClosingNozzleLine(
                    nozzle_uuid=str(nozzle.uuid),
                    nozzle_name=nozzle.name,
                    fuel_type=fuel_label,
                    opening_reading=float(reading.opening_reading),
                    closing_reading=float(reading.closing_reading),
                    interim_6am_reading=reading.interim_6am_reading,
                    testing_liters=float(reading.testing_liters or 0.0),
                    sales_liters=float(reading.sales),
                    rate=active_rate,
                    amount=line_amt,
                    missing_reading=False,
                )
            )

        # 2. Vouchers breakdown (supports SPLIT mode)
        vouchers = list(
            db.scalars(
                select(Voucher).where(
                    Voucher.invoice_date == target_date,
                    Voucher.is_active.is_(True),
                )
            ).all()
        )
        cash_sales = Decimal("0.00")
        upi_sales = Decimal("0.00")
        card_sales = Decimal("0.00")
        bank_sales = Decimal("0.00")
        credit_sales = Decimal("0.00")
        upi_count = 0
        card_count = 0
        credit_count = 0

        for v in vouchers:
            if v.payment_mode == PaymentMode.CASH:
                cash_sales += v.total_amount
            elif v.payment_mode == PaymentMode.UPI:
                upi_sales += v.total_amount
                upi_count += 1
            elif v.payment_mode == PaymentMode.CARD:
                card_sales += v.total_amount
                card_count += 1
            elif v.payment_mode == PaymentMode.BANK:
                bank_sales += v.total_amount
            elif v.payment_mode == PaymentMode.CREDIT:
                credit_sales += v.total_amount
                credit_count += 1
            elif v.payment_mode == PaymentMode.SPLIT:
                c_amt = v.cash_amount or Decimal("0.00")
                u_amt = v.upi_amount or Decimal("0.00")
                cd_amt = v.card_amount or Decimal("0.00")
                cr_amt = v.credit_amount or Decimal("0.00")
                cash_sales += c_amt
                upi_sales += u_amt
                card_sales += cd_amt
                credit_sales += cr_amt
                if u_amt > 0:
                    upi_count += 1
                if cd_amt > 0:
                    card_count += 1
                if cr_amt > 0:
                    credit_count += 1

        total_voucher_sales = (cash_sales + upi_sales + card_sales + bank_sales + credit_sales).quantize(
            Decimal("0.01")
        )

        # 3. Cash expenses from register
        cash_expenses = db.scalar(
            select(func.coalesce(func.sum(Income.amount), Decimal("0.00"))).where(
                Income.income_date == target_date,
                Income.kind == IncomeKind.EXPENSE,
                Income.payment_mode == PaymentMode.CASH,
                Income.is_active.is_(True),
            )
        ) or Decimal("0.00")
        cash_expenses = Decimal(str(cash_expenses)).quantize(Decimal("0.01"))

        opening_float = self._previous_opening_float(db, target_date)

        # 4. Cross-validation warnings
        warnings: list[DayClosingWarning] = []
        if missing_nozzles:
            warnings.append(
                DayClosingWarning(
                    type="MISSING_NOZZLE_READING",
                    severity="WARNING",
                    message=f"{len(missing_nozzles)} nozzle(s) missing closing reading: {', '.join(missing_nozzles)}.",
                )
            )

        meter_gap = abs(gross_meter_sales - total_voucher_sales)
        if meter_gap > Decimal("500.00") and (gross_meter_sales > 0 or total_voucher_sales > 0):
            warnings.append(
                DayClosingWarning(
                    type="METER_VOUCHER_MISMATCH",
                    severity="WARNING",
                    message=(
                        f"Meter sales (₹{gross_meter_sales:,.2f}) differ from billed vouchers "
                        f"(₹{total_voucher_sales:,.2f}) by ₹{meter_gap:,.2f}."
                    ),
                )
            )

        # Check repeated shortages in recent ShiftSettlements
        recent_shifts = list(
            db.scalars(
                select(ShiftSettlement)
                .where(ShiftSettlement.responsible_employee_id.isnot(None))
                .order_by(ShiftSettlement.settlement_date.desc(), ShiftSettlement.id.desc())
                .limit(20)
            ).all()
        )
        emp_shortages: dict[int, int] = {}
        emp_totals: dict[int, int] = {}
        for s in recent_shifts:
            eid = s.responsible_employee_id
            if eid is None:
                continue
            emp_totals[eid] = emp_totals.get(eid, 0) + 1
            if emp_totals[eid] <= 5 and Decimal(str(s.variance)) < Decimal("0.00"):
                emp_shortages[eid] = emp_shortages.get(eid, 0) + 1
        for eid, cnt in emp_shortages.items():
            if cnt >= 3:
                from app.models.employee import Employee
                emp = db.get(Employee, eid)
                emp_name = emp.full_name if emp else f"Employee #{eid}"
                warnings.append(
                    DayClosingWarning(
                        type="REPEATED_STAFF_SHORTAGE",
                        severity="WARNING",
                        message=f"{emp_name} had cash shortages in {cnt} of their last 5 shifts.",
                    )
                )

        # 5. Stock dip preview
        stock_summary = self.stock_service.get_daily_summary(db, target_date)
        tank_dips = [
            DayClosingTankDipPreview(
                tank_uuid=t.tank_uuid,
                tank_name=t.tank_name,
                fuel_type=t.fuel_type.value if hasattr(t.fuel_type, "value") else str(t.fuel_type),
                capacity_liters=t.capacity_liters,
                book_stock=t.book_stock,
                physical_dip=t.physical_dip,
                variance_liters=t.variance_liters,
                status=t.status,
            )
            for t in stock_summary.items
        ]
        for alert in stock_summary.alerts:
            warnings.append(
                DayClosingWarning(
                    type="STOCK_LOSS_TREND",
                    severity="ERROR",
                    message=alert.message,
                )
            )

        return DayClosingDraftResponse(
            closing_date=target_date,
            already_closed=existing is not None and existing.status in ("CLOSED", "LOCKED"),
            existing_closing_uuid=str(existing.uuid) if existing else None,
            gross_meter_sales=gross_meter_sales.quantize(Decimal("0.01")),
            cash_sales=cash_sales.quantize(Decimal("0.01")),
            upi_sales=upi_sales.quantize(Decimal("0.01")),
            card_sales=card_sales.quantize(Decimal("0.01")),
            bank_sales=bank_sales.quantize(Decimal("0.01")),
            credit_sales=credit_sales.quantize(Decimal("0.01")),
            total_voucher_sales=total_voucher_sales,
            upi_count=upi_count,
            card_count=card_count,
            credit_count=credit_count,
            cash_expenses=cash_expenses,
            opening_float=opening_float.quantize(Decimal("0.01")),
            nozzle_lines=nozzle_lines,
            tank_dips=tank_dips,
            warnings=warnings,
        )

    def ensure_unbilled_cash_voucher(
        self,
        db: Session,
        target_date: date,
        pump_id: int | None = None,
        actor_id: int | None = None,
    ) -> dict[str, object]:
        """Post or update the daily walk-in Cash Summary voucher for unbilled meter sales."""
        from app.core.enums import FuelType, PaymentStatus, VerificationStatus

        draft = self.compute_draft(db, target_date)
        gap = (draft.gross_meter_sales - draft.total_voucher_sales).quantize(Decimal("0.01"))
        if gap <= Decimal("0.00"):
            return {
                "created": False,
                "voucher": None,
                "amount": Decimal("0.00"),
                "message": "No unbilled cash gap to post.",
            }

        inv_num = f"CASH-SUM-{target_date.strftime('%Y%m%d')}"
        stmt = select(Voucher).where(
            Voucher.invoice_number == inv_num,
            Voucher.is_active.is_(True),
        )
        if pump_id is not None:
            stmt = stmt.where(Voucher.pump_id == pump_id)
        existing_v = db.scalar(stmt)

        if existing_v is not None:
            existing_v.total_amount = (Decimal(str(existing_v.total_amount)) + gap).quantize(Decimal("0.01"))
            existing_v.amount_paid = existing_v.total_amount
            existing_v.cash_amount = existing_v.total_amount
            db.flush()
            voucher = existing_v
        else:
            fuel_type = "DIESEL"
            rate = Decimal("90.00")
            if draft.nozzle_lines:
                top_line = max(draft.nozzle_lines, key=lambda n: n.amount)
                fuel_type = top_line.fuel_type
                rate = Decimal(str(top_line.rate or 0)).quantize(Decimal("0.01")) or Decimal("90.00")
            qty = (gap / rate).quantize(Decimal("0.01")) if rate > Decimal("0.00") else Decimal("0.00")
            voucher = Voucher(
                pump_id=pump_id,
                invoice_number=inv_num,
                invoice_date=target_date,
                customer_name="Walk-in Cash Summary",
                fuel_type=FuelType(fuel_type),
                quantity_liters=qty,
                rate_per_liter=rate,
                total_amount=gap,
                payment_mode=PaymentMode.CASH,
                cash_amount=gap,
                amount_paid=gap,
                payment_status=PaymentStatus.PAID,
                verification_status=VerificationStatus.VERIFIED,
                remarks="Auto-balanced unbilled cash fuel from Day Closing",
            )
            db.add(voucher)
            db.flush()

        self.audit_service.log_action(
            db,
            action="Auto-Balanced Unbilled Cash",
            target_table="vouchers",
            target_id=str(voucher.uuid),
            actor_id=actor_id,
            new_values={"date": target_date.isoformat(), "amount": str(gap)},
        )
        return {
            "created": True,
            "voucher": voucher,
            "amount": gap,
            "message": f"Posted Summary Cash Sale of ₹{gap:,.2f}.",
        }

    def save_closing(
        self,
        db: Session,
        payload: DayClosingCreate,
        actor_id: int | None = None,
    ) -> DayClosing:
        existing = db.scalar(
            select(DayClosing).where(DayClosing.closing_date == payload.closing_date)
        )
        if existing is not None and existing.status in ("CLOSED", "LOCKED"):
            raise ValueError(f"Business day {payload.closing_date} is already closed.")

        # Persist any tank dips provided during Day Closing first so warnings reflect them
        if payload.tank_dips:
            self.stock_service.compute_daily_variance(
                db,
                payload.closing_date,
                physical_dips=payload.tank_dips,
                actor_id=actor_id,
            )

        # Auto-post walk-in cash fuel summary so Cash-in-Hand, P&L, and Tally stay connected
        if payload.auto_balance_cash:
            from app.database.scoping import active_pump_id
            resolved_pump_id = existing.pump_id if existing else active_pump_id.get()
            self.ensure_unbilled_cash_voucher(
                db,
                payload.closing_date,
                pump_id=resolved_pump_id,
                actor_id=actor_id,
            )

        draft = self.compute_draft(db, payload.closing_date)
        opening_float = (
            payload.opening_float
            if payload.opening_float is not None
            else draft.opening_float
        )

        denom_total = (
            Decimal(payload.notes_500) * 500
            + Decimal(payload.notes_200) * 200
            + Decimal(payload.notes_100) * 100
            + Decimal(payload.notes_50) * 50
            + Decimal(payload.notes_20) * 20
            + Decimal(payload.notes_10) * 10
            + payload.coins
        ).quantize(Decimal("0.01"))

        if payload.physical_cash_counted is not None and denom_total == Decimal("0.00"):
            physical_cash = Decimal(str(payload.physical_cash_counted)).quantize(Decimal("0.01"))
        elif denom_total > Decimal("0.00"):
            physical_cash = denom_total
        else:
            physical_cash = Decimal(str(payload.physical_cash_counted or "0.00")).quantize(Decimal("0.01"))

        from app.models.payment import Payment
        cash_payments = (
            db.scalar(
                select(func.coalesce(func.sum(Payment.amount), Decimal("0.00"))).where(
                    Payment.payment_date == payload.closing_date,
                    Payment.payment_mode == PaymentMode.CASH,
                    Payment.is_active.is_(True),
                )
            )
            or Decimal("0.00")
        ) + (
            db.scalar(
                select(func.coalesce(func.sum(func.coalesce(Payment.cash_amount, Decimal("0.00"))), Decimal("0.00"))).where(
                    Payment.payment_date == payload.closing_date,
                    Payment.payment_mode == PaymentMode.SPLIT,
                    Payment.is_active.is_(True),
                )
            )
            or Decimal("0.00")
        )

        expected_cash = (
            opening_float
            + draft.cash_sales
            + cash_payments
            - draft.cash_expenses
            - payload.cash_to_next_day
        ).quantize(Decimal("0.01"))
        variance = (physical_cash - expected_cash).quantize(Decimal("0.01"))

        warnings_json = [w.model_dump(mode="json") for w in draft.warnings]
        nozzle_snapshot = [n.model_dump(mode="json") for n in draft.nozzle_lines]

        if existing is not None:
            closing = existing
        else:
            closing = DayClosing(closing_date=payload.closing_date)
            db.add(closing)

        closing.status = "LOCKED"
        closing.gross_meter_sales = draft.gross_meter_sales
        closing.cash_sales = draft.cash_sales
        closing.upi_sales = draft.upi_sales
        closing.card_sales = draft.card_sales
        closing.bank_sales = draft.bank_sales
        closing.credit_sales = draft.credit_sales
        closing.total_voucher_sales = draft.total_voucher_sales
        closing.cash_expenses = draft.cash_expenses
        closing.opening_float = opening_float
        closing.physical_cash_counted = physical_cash
        closing.cash_to_next_day = payload.cash_to_next_day
        closing.expected_cash = expected_cash
        closing.variance = variance
        closing.notes_500 = payload.notes_500
        closing.notes_200 = payload.notes_200
        closing.notes_100 = payload.notes_100
        closing.notes_50 = payload.notes_50
        closing.notes_20 = payload.notes_20
        closing.notes_10 = payload.notes_10
        closing.coins = payload.coins
        closing.warnings = warnings_json
        closing.closed_by_user_id = actor_id
        closing.closed_at = datetime.now(timezone.utc)
        closing.nozzle_snapshot = nozzle_snapshot
        closing.notes = payload.notes
        closing.settlement_bank_account_uuid = payload.settlement_bank_account_uuid
        closing.cash_deposited_to_bank = payload.cash_deposited_to_bank

        db.flush()

        # Auto-sync digital sales (UPI + Card) and optional cash deposit to BankAccount(s)
        synced_txn_ids = self._sync_closing_to_bank(
            db,
            closing=closing,
            bank_account_uuid=payload.settlement_bank_account_uuid,
            upi_bank_account_uuid=payload.upi_bank_account_uuid,
            card_bank_account_uuid=payload.card_bank_account_uuid,
            cash_deposited=payload.cash_deposited_to_bank,
            actor_id=actor_id,
        )
        closing.synced_bank_txn_ids = synced_txn_ids or None

        # Two-way sync denominations into DailyCashSheet
        from app.models.daily_cash_sheet import DailyCashSheet

        cash_sheet = db.scalar(
            select(DailyCashSheet).where(DailyCashSheet.sheet_date == payload.closing_date)
        )
        if cash_sheet is None:
            cash_sheet = DailyCashSheet(
                sheet_date=payload.closing_date,
                pump_id=closing.pump_id,
            )
            db.add(cash_sheet)
        cash_sheet.notes_500 = payload.notes_500
        cash_sheet.notes_200 = payload.notes_200
        cash_sheet.notes_100 = payload.notes_100
        cash_sheet.notes_50 = payload.notes_50
        cash_sheet.notes_20 = payload.notes_20
        cash_sheet.notes_10 = payload.notes_10

        # Auto-mark shift attendants PRESENT for this closing date
        from app.services.employee_service import EmployeeService
        EmployeeService().sync_attendance_from_shifts(db, payload.closing_date)

        db.commit()
        db.refresh(closing)

        self.audit_service.log_action(
            db,
            action="Closed Business Day",
            target_table="day_closings",
            target_id=str(closing.id),
            actor_id=actor_id,
            new_values={
                "closing_date": closing.closing_date.isoformat(),
                "gross_meter_sales": str(closing.gross_meter_sales),
                "total_voucher_sales": str(closing.total_voucher_sales),
                "expected_cash": str(closing.expected_cash),
                "physical_cash_counted": str(closing.physical_cash_counted),
                "variance": str(closing.variance),
            },
        )
        return closing

    def _sync_closing_to_bank(
        self,
        db: Session,
        *,
        closing: DayClosing,
        bank_account_uuid: str | None,
        upi_bank_account_uuid: str | None = None,
        card_bank_account_uuid: str | None = None,
        cash_deposited: Decimal,
        actor_id: int | None,
    ) -> list[int]:
        """Credit UPI + Card collections (to separate or shared bank accounts like SBI/HDFC)
        and optional cash deposit."""
        from app.models.bank_account import BankAccount
        from app.schemas.bank_account import CashDepositRequest
        from app.services.bank_account_service import BankAccountService

        digital_total = (closing.upi_sales + closing.card_sales).quantize(Decimal("0.01"))
        if digital_total <= Decimal("0.00") and cash_deposited <= Decimal("0.00"):
            return []

        bank_service = BankAccountService()

        def _resolve(acc_uuid: str | None) -> BankAccount | None:
            if acc_uuid:
                return db.scalars(
                    select(BankAccount).where(
                        BankAccount.uuid == acc_uuid,
                        BankAccount.is_active.is_(True),
                    )
                ).first()
            return None

        default_account = _resolve(bank_account_uuid)
        if default_account is None:
            default_account = db.scalars(
                select(BankAccount)
                .where(
                    BankAccount.pump_id == closing.pump_id,
                    BankAccount.is_active.is_(True),
                )
                .order_by(BankAccount.id.asc())
                .limit(1)
            ).first()

        upi_acc = _resolve(upi_bank_account_uuid) or default_account
        card_acc = _resolve(card_bank_account_uuid) or default_account

        if default_account is not None:
            closing.settlement_bank_account_uuid = str(default_account.uuid)

        txn_ids: list[int] = []

        if upi_acc and card_acc and upi_acc.id == card_acc.id:
            if digital_total > Decimal("0.00"):
                txn = bank_service.adjust_bank_balance(
                    db,
                    bank_account_id=upi_acc.id,
                    amount=digital_total,
                    transaction_type="INCOME",
                    transaction_date=closing.closing_date,
                    reference_number=f"DAYCLOSE-{closing.closing_date.isoformat()}-DIGITAL",
                    remarks=(
                        f"Auto-synced UPI (₹{closing.upi_sales:,.2f}) + "
                        f"Card (₹{closing.card_sales:,.2f}) from Day Closing"
                    ),
                    pump_id=closing.pump_id,
                )
                txn_ids.append(txn.id)
        else:
            if upi_acc and closing.upi_sales > Decimal("0.00"):
                txn = bank_service.adjust_bank_balance(
                    db,
                    bank_account_id=upi_acc.id,
                    amount=closing.upi_sales,
                    transaction_type="INCOME",
                    transaction_date=closing.closing_date,
                    reference_number=f"DAYCLOSE-{closing.closing_date.isoformat()}-UPI",
                    remarks=f"Auto-synced UPI (₹{closing.upi_sales:,.2f}) from Day Closing",
                    pump_id=closing.pump_id,
                )
                txn_ids.append(txn.id)
            if card_acc and closing.card_sales > Decimal("0.00"):
                txn = bank_service.adjust_bank_balance(
                    db,
                    bank_account_id=card_acc.id,
                    amount=closing.card_sales,
                    transaction_type="INCOME",
                    transaction_date=closing.closing_date,
                    reference_number=f"DAYCLOSE-{closing.closing_date.isoformat()}-CARD",
                    remarks=f"Auto-synced Card EDC (₹{closing.card_sales:,.2f}) from Day Closing",
                    pump_id=closing.pump_id,
                )
                txn_ids.append(txn.id)

        if default_account and cash_deposited > Decimal("0.00"):
            dep_txn = bank_service.deposit_cash_to_bank(
                db,
                CashDepositRequest(
                    bank_account_uuid=str(default_account.uuid),
                    amount=cash_deposited,
                    deposit_date=closing.closing_date,
                    reference_number=f"DAYCLOSE-{closing.closing_date.isoformat()}-CASH",
                    remarks=f"Cash deposited during Day Closing ({closing.closing_date.isoformat()})",
                ),
                pump_id=closing.pump_id,
                actor_id=actor_id,
            )
            txn_ids.append(dep_txn.id)

        return txn_ids

    def _reverse_synced_bank_txns(self, db: Session, closing: DayClosing) -> None:
        """Reverse bank transactions created when this DayClosing was locked."""
        txn_ids = closing.synced_bank_txn_ids or []
        if not txn_ids:
            return
        from app.models.bank_account import BankAccount, BankTransaction

        txns = list(
            db.scalars(select(BankTransaction).where(BankTransaction.id.in_(txn_ids))).all()
        )
        for txn in txns:
            if txn.bank_account_id:
                acc = db.get(BankAccount, txn.bank_account_id)
                if acc is not None:
                    if txn.transaction_type in ("INCOME", "DEPOSIT"):
                        acc.current_balance = acc.current_balance - txn.amount
                    elif txn.transaction_type in ("EXPENSE", "WITHDRAWAL"):
                        acc.current_balance = acc.current_balance + txn.amount
            db.delete(txn)
        closing.synced_bank_txn_ids = None

    def reopen_closing(self, db: Session, closing_uuid: str, actor_id: int | None = None) -> DayClosing:
        closing = db.scalar(select(DayClosing).where(DayClosing.uuid == closing_uuid))
        if not closing:
            raise ValueError("Day closing record not found.")
        self._reverse_synced_bank_txns(db, closing)

        # Deactivate auto-balanced cash summary voucher if present so user can edit & re-close cleanly
        inv_num = f"CASH-SUM-{closing.closing_date.strftime('%Y%m%d')}"
        auto_cash_voucher = db.scalar(
            select(Voucher).where(
                Voucher.pump_id == closing.pump_id,
                Voucher.invoice_number == inv_num,
                Voucher.is_active.is_(True),
                Voucher.remarks == "Auto-balanced unbilled cash fuel from Day Closing",
            )
        )
        if auto_cash_voucher is not None:
            auto_cash_voucher.is_active = False

        closing.status = "DRAFT"
        db.commit()
        db.refresh(closing)
        self.audit_service.log_action(
            db,
            action="Reopened Business Day",
            target_table="day_closings",
            target_id=str(closing.id),
            actor_id=actor_id,
            new_values={"closing_date": closing.closing_date.isoformat(), "status": "DRAFT"},
        )
        return closing

    def list_closings(self, db: Session, limit: int = 30) -> list[DayClosing]:
        return list(
            db.scalars(
                select(DayClosing)
                .order_by(DayClosing.closing_date.desc(), DayClosing.id.desc())
                .limit(limit)
            ).all()
        )

    def get_by_uuid(self, db: Session, closing_uuid: str) -> DayClosing:
        closing = db.scalar(select(DayClosing).where(DayClosing.uuid == closing_uuid))
        if not closing:
            raise ValueError("Day closing record not found.")
        return closing
