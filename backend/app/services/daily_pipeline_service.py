from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import (
    IncomeKind,
    PaymentMode,
    PaymentStatus,
    VerificationStatus,
)
from app.models.bank_account import BankAccount, BankTransaction
from app.models.customer import Customer
from app.models.daily_cash_sheet import DailyCashSheet
from app.models.day_closing import DayClosing
from app.models.fuel_tank import FuelTank
from app.models.stock_variance import StockVariance
from app.models.income import Income
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.payment import Payment
from app.models.voucher_settlement import VoucherSettlement
from app.models.price_schedule import PriceSchedule
from app.models.recurring_expense import RecurringExpense
from app.models.shift_settlement import ShiftSettlement
from app.models.voucher import Voucher
from app.services.audit_log_service import AuditLogService
from app.services.bank_account_service import BankAccountService
from app.services.day_closing_service import DayClosingService


def _q(val: Decimal | float | int | str | None) -> Decimal:
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(Decimal("0.01"))


class DailyPipelineService:
    """Single-source daily calculation engine, 5-Point Auto-Audit, Self-Healing
    Balance Checker, Books Health Check, and Pre-Lock / Pre-Export Gates."""

    def __init__(self) -> None:
        self.day_closing_service = DayClosingService()
        self.bank_service = BankAccountService()
        self.audit_service = AuditLogService()

    # ------------------------------------------------------------------
    # 1. Single-Source "Zero-Reentry" Daily Pipeline Snapshot
    # ------------------------------------------------------------------
    def get_daily_snapshot(
        self, db: Session, target_date: date, pump_id: int
    ) -> dict[str, Any]:
        draft = self.day_closing_service.compute_draft(db, target_date)

        # Cash payments received today (credit collections)
        cash_payments = _q(
            db.scalar(
                select(func.coalesce(func.sum(Payment.amount), Decimal("0.00"))).where(
                    Payment.pump_id == pump_id,
                    Payment.payment_date == target_date,
                    Payment.payment_mode == PaymentMode.CASH,
                    Payment.is_active.is_(True),
                )
            )
        ) + _q(
            db.scalar(
                select(
                    func.coalesce(
                        func.sum(func.coalesce(Payment.cash_amount, Decimal("0.00"))),
                        Decimal("0.00"),
                    )
                ).where(
                    Payment.pump_id == pump_id,
                    Payment.payment_date == target_date,
                    Payment.payment_mode == PaymentMode.SPLIT,
                    Payment.is_active.is_(True),
                )
            )
        )

        digital_payments = _q(
            db.scalar(
                select(func.coalesce(func.sum(Payment.amount), Decimal("0.00"))).where(
                    Payment.pump_id == pump_id,
                    Payment.payment_date == target_date,
                    Payment.payment_mode.in_(
                        [PaymentMode.UPI, PaymentMode.CARD, PaymentMode.BANK]
                    ),
                    Payment.is_active.is_(True),
                )
            )
        ) + _q(
            db.scalar(
                select(
                    func.coalesce(
                        func.sum(
                            func.coalesce(Payment.bank_amount, Decimal("0.00"))
                        ),
                        Decimal("0.00"),
                    )
                ).where(
                    Payment.pump_id == pump_id,
                    Payment.payment_date == target_date,
                    Payment.payment_mode == PaymentMode.SPLIT,
                    Payment.is_active.is_(True),
                )
            )
        )

        # Cash Lube / Other Income
        cash_other_income = _q(
            db.scalar(
                select(func.coalesce(func.sum(Income.amount), Decimal("0.00"))).where(
                    Income.pump_id == pump_id,
                    Income.income_date == target_date,
                    Income.kind == IncomeKind.INCOME,
                    Income.payment_mode == PaymentMode.CASH,
                    Income.is_active.is_(True),
                )
            )
        )

        # Cash deposited to bank today (DEPOSIT in Income or BankTransaction DEPOSIT)
        cash_bank_deposits = _q(
            db.scalar(
                select(
                    func.coalesce(func.sum(BankTransaction.amount), Decimal("0.00"))
                ).where(
                    BankTransaction.pump_id == pump_id,
                    BankTransaction.transaction_date == target_date,
                    BankTransaction.transaction_type == "DEPOSIT",
                )
            )
        )

        # Denomination source priority: DayClosing (if exists) -> DailyCashSheet -> latest ShiftSettlement
        closing = db.scalar(
            select(DayClosing).where(
                DayClosing.pump_id == pump_id,
                DayClosing.closing_date == target_date,
            )
        )
        cash_sheet = db.scalar(
            select(DailyCashSheet).where(
                DailyCashSheet.pump_id == pump_id,
                DailyCashSheet.sheet_date == target_date,
            )
        )
        shift_settlements = list(
            db.scalars(
                select(ShiftSettlement)
                .where(
                    ShiftSettlement.pump_id == pump_id,
                    ShiftSettlement.settlement_date == target_date,
                )
                .order_by(ShiftSettlement.id.desc())
            ).all()
        )
        latest_shift = shift_settlements[0] if shift_settlements else None
        shift_variance_total = sum(
            (_q(s.variance) for s in shift_settlements), Decimal("0.00")
        )

        if closing is not None and (
            closing.notes_500
            + closing.notes_200
            + closing.notes_100
            + closing.notes_50
            + closing.notes_20
            + closing.notes_10
            > 0
            or _q(closing.coins) > Decimal("0.00")
        ):
            denom_source = "DAY_CLOSING"
            denoms = {
                "notes_500": closing.notes_500,
                "notes_200": closing.notes_200,
                "notes_100": closing.notes_100,
                "notes_50": closing.notes_50,
                "notes_20": closing.notes_20,
                "notes_10": closing.notes_10,
                "coins": float(_q(closing.coins)),
            }
        elif cash_sheet is not None:
            denom_source = "DAILY_REGISTER"
            denoms = {
                "notes_500": cash_sheet.notes_500,
                "notes_200": cash_sheet.notes_200,
                "notes_100": cash_sheet.notes_100,
                "notes_50": cash_sheet.notes_50,
                "notes_20": cash_sheet.notes_20,
                "notes_10": cash_sheet.notes_10,
                "coins": 0.0,
            }
        elif latest_shift is not None:
            denom_source = "SHIFT_SETTLEMENT"
            denoms = {
                "notes_500": latest_shift.notes_500,
                "notes_200": latest_shift.notes_200,
                "notes_100": latest_shift.notes_100,
                "notes_50": latest_shift.notes_50,
                "notes_20": latest_shift.notes_20,
                "notes_10": latest_shift.notes_10,
                "coins": float(_q(latest_shift.coins)),
            }
        else:
            denom_source = "NONE"
            denoms = {
                "notes_500": 0,
                "notes_200": 0,
                "notes_100": 0,
                "notes_50": 0,
                "notes_20": 0,
                "notes_10": 0,
                "coins": 0.0,
            }

        counted_notes_total = (
            Decimal(denoms["notes_500"]) * 500
            + Decimal(denoms["notes_200"]) * 200
            + Decimal(denoms["notes_100"]) * 100
            + Decimal(denoms["notes_50"]) * 50
            + Decimal(denoms["notes_20"]) * 20
            + Decimal(denoms["notes_10"]) * 10
            + Decimal(str(denoms["coins"]))
        ).quantize(Decimal("0.01"))

        if (
            closing is not None
            and counted_notes_total == Decimal("0.00")
            and _q(closing.physical_cash_counted) > Decimal("0.00")
        ):
            counted_notes_total = _q(closing.physical_cash_counted)

        cash_to_next_day = (
            _q(closing.cash_to_next_day)
            if closing is not None
            else (_q(latest_shift.cash_handed_to_next_shift) if latest_shift else Decimal("0.00"))
        )

        # Unbilled cash fuel = Gross Meter Sales - Total Voucher Sales
        unbilled_cash_fuel = max(
            Decimal("0.00"),
            _q(draft.gross_meter_sales) - _q(draft.total_voucher_sales),
        ).quantize(Decimal("0.01"))

        # Include unbilled walk-in cash fuel in live drawer expectation before Day Lock
        expected_drawer_cash = (
            _q(draft.opening_float)
            + _q(draft.cash_sales)
            + unbilled_cash_fuel
            + cash_other_income
            + cash_payments
            - _q(draft.cash_expenses)
            - cash_bank_deposits
            - cash_to_next_day
        ).quantize(Decimal("0.01"))

        cash_variance = (counted_notes_total - expected_drawer_cash).quantize(
            Decimal("0.01")
        )

        # Single-Truth Bank Reconciliation Sheet for target_date
        bank_accounts = list(
            db.scalars(
                select(BankAccount).where(
                    BankAccount.pump_id == pump_id,
                    BankAccount.is_active.is_(True),
                )
            ).all()
        )
        bank_rows: list[dict[str, Any]] = []
        for acc in bank_accounts:
            day_txns = list(
                db.scalars(
                    select(BankTransaction)
                    .where(
                        BankTransaction.bank_account_id == acc.id,
                        BankTransaction.transaction_date == target_date,
                    )
                    .order_by(BankTransaction.id.asc())
                ).all()
            )
            inflows = Decimal("0.00")
            outflows = Decimal("0.00")
            txn_items = []
            for t in day_txns:
                amt = _q(t.amount)
                if t.transaction_type in ("INCOME", "DEPOSIT", "TRANSFER_IN", "OPENING_BALANCE"):
                    inflows += amt
                else:
                    outflows += amt
                txn_items.append(
                    {
                        "uuid": str(t.uuid),
                        "type": t.transaction_type,
                        "amount": float(amt),
                        "reference_number": t.reference_number,
                        "remarks": t.remarks,
                    }
                )
            net_today = (inflows - outflows).quantize(Decimal("0.01"))
            opening_est = (_q(acc.current_balance) - net_today).quantize(Decimal("0.01"))
            bank_rows.append(
                {
                    "bank_account_uuid": str(acc.uuid),
                    "bank_name": acc.bank_name,
                    "account_name": acc.account_name,
                    "opening_balance": float(opening_est),
                    "inflows": float(inflows),
                    "outflows": float(outflows),
                    "closing_balance": float(_q(acc.current_balance)),
                    "transactions": txn_items,
                }
            )

        from app.services.report_service import ReportService

        pnl_today = ReportService().pnl_report(
            db, from_date=target_date, to_date=target_date
        )

        return {
            "date": target_date.isoformat(),
            "is_locked": closing is not None and closing.status in ("CLOSED", "LOCKED"),
            "closing_uuid": str(closing.uuid) if closing else None,
            "meters": {
                "gross_meter_sales": float(_q(draft.gross_meter_sales)),
                "total_liters": round(
                    sum(n.sales_liters for n in draft.nozzle_lines), 2
                ),
                "missing_nozzles": [
                    n.nozzle_name for n in draft.nozzle_lines if n.missing_reading
                ],
                "nozzle_count": len(draft.nozzle_lines),
            },
            "vouchers": {
                "cash_sales": float(_q(draft.cash_sales)),
                "upi_sales": float(_q(draft.upi_sales)),
                "card_sales": float(_q(draft.card_sales)),
                "bank_sales": float(_q(draft.bank_sales)),
                "credit_sales": float(_q(draft.credit_sales)),
                "total_voucher_sales": float(_q(draft.total_voucher_sales)),
                "unbilled_cash_fuel": float(unbilled_cash_fuel),
                "meter_vs_voucher_gap": float(
                    (_q(draft.gross_meter_sales) - _q(draft.total_voucher_sales)).quantize(
                        Decimal("0.01")
                    )
                ),
            },
            "cash_proof": {
                "opening_float": float(_q(draft.opening_float)),
                "cash_fuel_sales": float((_q(draft.cash_sales) + unbilled_cash_fuel).quantize(Decimal("0.01"))),
                "cash_other_income": float(cash_other_income),
                "cash_payments_received": float(cash_payments),
                "cash_expenses": float(_q(draft.cash_expenses)),
                "cash_bank_deposits": float(cash_bank_deposits),
                "cash_to_next_day": float(cash_to_next_day),
                "expected_drawer_cash": float(expected_drawer_cash),
                "counted_notes_total": float(counted_notes_total),
                "variance": float(cash_variance),
                "denom_source": denom_source,
                "denominations": denoms,
            },
            "digital_collections": {
                "voucher_upi": float(_q(draft.upi_sales)),
                "voucher_card": float(_q(draft.card_sales)),
                "voucher_bank": float(_q(draft.bank_sales)),
                "credit_payments_digital": float(digital_payments),
                "total_digital": float(
                    (
                        _q(draft.upi_sales)
                        + _q(draft.card_sales)
                        + _q(draft.bank_sales)
                        + digital_payments
                    ).quantize(Decimal("0.01"))
                ),
            },
            "shift_settlement": {
                "count": len(shift_settlements),
                "total_variance": float(shift_variance_total),
                "latest_uuid": str(latest_shift.uuid) if latest_shift else None,
            },
            "profit": {
                "fuel_revenue": float(_q(pnl_today.fuel_revenue)),
                "fuel_liters": float(_q(pnl_today.fuel_liters)),
                "fuel_gross_margin": float(_q(pnl_today.fuel_gross_margin)),
                "commission_profit": float(_q(pnl_today.commission_profit)),
                "margin_source": pnl_today.margin_source,
                "other_income": float(_q(pnl_today.other_income)),
                "total_expenses": float(_q(pnl_today.total_expenses)),
                "net_profit": float(_q(pnl_today.net_profit)),
            },
            "bank_reconciliation": bank_rows,
        }

    # ------------------------------------------------------------------
    # 2. Live "5-Point Auto-Audit" Mismatch Engine
    # ------------------------------------------------------------------
    def run_5_point_audit(
        self, db: Session, target_date: date, pump_id: int
    ) -> dict[str, Any]:
        snapshot = self.get_daily_snapshot(db, target_date, pump_id)
        checks: list[dict[str, Any]] = []

        # Point 1: Meters vs Billed
        meter_amt = Decimal(str(snapshot["meters"]["gross_meter_sales"]))
        billed_amt = Decimal(str(snapshot["vouchers"]["total_voucher_sales"]))
        gap_amt = (meter_amt - billed_amt).quantize(Decimal("0.01"))
        p1_ok = abs(gap_amt) <= Decimal("1.00")
        checks.append(
            {
                "id": "meters_vs_billed",
                "title": "Meters vs. Billed",
                "status": "OK" if p1_ok else "MISMATCH",
                "expected": float(meter_amt),
                "actual": float(billed_amt),
                "difference": float(gap_amt),
                "message": (
                    "Meter sales match billed vouchers."
                    if p1_ok
                    else f"Unbilled gap of ₹{gap_amt:,.2f} between Meters and Vouchers."
                ),
                "fix_action": "auto_balance_unbilled_cash" if gap_amt > Decimal("1.00") else None,
                "fix_label": "Post Summary Cash Sale" if gap_amt > Decimal("1.00") else None,
            }
        )

        # Point 2: Tank Dips vs Nozzles
        tanks = list(
            db.scalars(
                select(FuelTank).where(
                    FuelTank.pump_id == pump_id, FuelTank.is_active.is_(True)
                )
            ).all()
        )
        variances = list(
            db.scalars(
                select(StockVariance).where(
                    StockVariance.pump_id == pump_id,
                    StockVariance.variance_date == target_date,
                )
            ).all()
        )
        total_dip_var = sum(
            (Decimal(str(v.variance_liters or 0)) for v in variances), Decimal("0.00")
        )
        flagged_tanks = [
            v for v in variances if v.status in ("WARNING", "CRITICAL")
        ]
        p2_ok = len(flagged_tanks) == 0
        checks.append(
            {
                "id": "tank_dips_vs_nozzles",
                "title": "Tank Dips vs. Nozzles",
                "status": "OK" if p2_ok else "MISMATCH",
                "expected": 0.0,
                "actual": float(total_dip_var.quantize(Decimal("0.01"))),
                "difference": float(total_dip_var.quantize(Decimal("0.01"))),
                "message": (
                    f"All {len(tanks)} tank(s) within threshold."
                    if p2_ok
                    else f"{len(flagged_tanks)} tank(s) show physical dip vs nozzle variance ({total_dip_var:+.1f} L)."
                ),
                "fix_action": None,
                "fix_label": None,
            }
        )

        # Point 3: Expected vs Counted Cash
        exp_cash = Decimal(str(snapshot["cash_proof"]["expected_drawer_cash"]))
        cnt_cash = Decimal(str(snapshot["cash_proof"]["counted_notes_total"]))
        cash_diff = (cnt_cash - exp_cash).quantize(Decimal("0.01"))
        p3_ok = abs(cash_diff) <= Decimal("100.00") or (
            cnt_cash == Decimal("0.00") and exp_cash == Decimal("0.00")
        )
        checks.append(
            {
                "id": "expected_vs_counted_cash",
                "title": "Expected vs. Counted Cash",
                "status": "OK" if p3_ok else "MISMATCH",
                "expected": float(exp_cash),
                "actual": float(cnt_cash),
                "difference": float(cash_diff),
                "message": (
                    "Drawer cash matches expected balance."
                    if p3_ok
                    else f"Cash drawer variance of ₹{cash_diff:+,.2f}."
                ),
                "fix_action": None,
                "fix_label": None,
            }
        )

        # Point 4: Customer Ledger vs Unpaid Bills
        drifted_customers = self.check_customer_balances(db, pump_id)
        p4_ok = len(drifted_customers) == 0
        total_drift = sum(
            (abs(Decimal(str(c["difference"]))) for c in drifted_customers),
            Decimal("0.00"),
        )
        checks.append(
            {
                "id": "customer_ledger_vs_bills",
                "title": "Customer Ledger vs. Unpaid Bills",
                "status": "OK" if p4_ok else "MISMATCH",
                "expected": 0.0,
                "actual": float(total_drift.quantize(Decimal("0.01"))),
                "difference": float(total_drift.quantize(Decimal("0.01"))),
                "message": (
                    "All customer balances match opening + unpaid bills - advances."
                    if p4_ok
                    else f"{len(drifted_customers)} customer(s) have drifted balances (₹{total_drift:,.2f})."
                ),
                "fix_action": "fix_customer_balances" if not p4_ok else None,
                "fix_label": "Recalculate & Fix Balances" if not p4_ok else None,
                "details": drifted_customers[:10],
            }
        )

        # Point 5: UPI/Bank Entries Without Linked Bank
        unlinked = self._find_unlinked_bank_entries(db, pump_id, target_date)
        p5_ok = len(unlinked) == 0
        checks.append(
            {
                "id": "unlinked_bank_entries",
                "title": "UPI/Bank Entries Without Linked Bank",
                "status": "OK" if p5_ok else "MISMATCH",
                "expected": 0,
                "actual": len(unlinked),
                "difference": len(unlinked),
                "message": (
                    "Every UPI/Bank/Card entry is linked to a Bank Account."
                    if p5_ok
                    else f"{len(unlinked)} UPI/Bank/Card entry(s) missing a linked Bank Account."
                ),
                "fix_action": "fix_unlinked_bank_entries" if not p5_ok else None,
                "fix_label": "Auto-Link to Primary Bank" if not p5_ok else None,
                "details": unlinked[:10],
            }
        )

        mismatch_count = sum(1 for c in checks if c["status"] != "OK")
        return {
            "date": target_date.isoformat(),
            "mismatch_count": mismatch_count,
            "all_clear": mismatch_count == 0,
            "checks": checks,
        }

    # ------------------------------------------------------------------
    # 3. Pre-Lock 4-Checkpoint Day Closing Gate
    # ------------------------------------------------------------------
    def pre_lock_check(
        self,
        db: Session,
        target_date: date,
        pump_id: int,
        *,
        notes: str | None = None,
        responsible_employee_id: int | None = None,
        physical_cash_counted: Decimal | None = None,
        cash_to_next_day: Decimal = Decimal("0.00"),
    ) -> dict[str, Any]:
        snapshot = self.get_daily_snapshot(db, target_date, pump_id)
        missing_nozzles = snapshot["meters"]["missing_nozzles"]

        pending_ocr = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.pump_id == pump_id,
                Voucher.invoice_date == target_date,
                Voucher.is_active.is_(True),
                Voucher.verification_status == VerificationStatus.PENDING,
            )
        ) or 0

        unlinked = self._find_unlinked_bank_entries(db, pump_id, target_date)

        expected_cash = Decimal(str(snapshot["cash_proof"]["expected_drawer_cash"]))
        counted = (
            _q(physical_cash_counted)
            if physical_cash_counted is not None
            else Decimal(str(snapshot["cash_proof"]["counted_notes_total"]))
        )
        if cash_to_next_day:
            expected_cash = (
                expected_cash
                + Decimal(str(snapshot["cash_proof"]["cash_to_next_day"]))
                - _q(cash_to_next_day)
            )
        variance = (counted - expected_cash).quantize(Decimal("0.01"))
        variance_needs_reason = abs(variance) > Decimal("100.00") and not (
            (notes and notes.strip()) or responsible_employee_id is not None
        )

        checkpoints = [
            {
                "id": "nozzle_readings",
                "title": "All active nozzles have closing readings",
                "passed": len(missing_nozzles) == 0,
                "detail": (
                    "All active nozzles recorded."
                    if len(missing_nozzles) == 0
                    else f"Missing: {', '.join(missing_nozzles)}"
                ),
            },
            {
                "id": "ocr_queue_clear",
                "title": "Zero unreviewed OCR slips for this date",
                "passed": pending_ocr == 0,
                "detail": (
                    "OCR review queue is clear."
                    if pending_ocr == 0
                    else f"{pending_ocr} OCR slip(s) pending review."
                ),
            },
            {
                "id": "bank_linked",
                "title": "Zero UPI/BANK entries missing a linked Bank Account",
                "passed": len(unlinked) == 0,
                "detail": (
                    "All digital entries linked to bank accounts."
                    if len(unlinked) == 0
                    else f"{len(unlinked)} entry(s) missing bank link."
                ),
            },
            {
                "id": "cash_variance_explained",
                "title": "Cash variance within ±₹100 or has reason / staff tag",
                "passed": not variance_needs_reason,
                "detail": (
                    f"Variance ₹{variance:+,.2f} is within tolerance or explained."
                    if not variance_needs_reason
                    else f"Variance ₹{variance:+,.2f} exceeds ±₹100 — add a remark or staff recovery tag."
                ),
            },
        ]
        can_lock = all(cp["passed"] for cp in checkpoints)
        return {
            "date": target_date.isoformat(),
            "can_lock": can_lock,
            "checkpoints": checkpoints,
            "variance": float(variance),
        }

    # ------------------------------------------------------------------
    # 4. 1-Click "Auto-Balance Unbilled Cash"
    # ------------------------------------------------------------------
    def auto_balance_unbilled_cash(
        self, db: Session, target_date: date, pump_id: int, actor_id: int | None = None
    ) -> dict[str, Any]:
        DayClosingService.ensure_day_open(db, target_date)
        res = self.day_closing_service.ensure_unbilled_cash_voucher(
            db, target_date, pump_id=pump_id, actor_id=actor_id
        )
        if not res["created"]:
            return {
                "created": False,
                "message": res["message"],
                "amount": 0.0,
            }
        voucher = res["voucher"]
        db.commit()
        return {
            "created": True,
            "voucher_uuid": str(voucher.uuid),
            "invoice_number": voucher.invoice_number,
            "amount": float(res["amount"]),
            "message": res["message"],
        }

    # ------------------------------------------------------------------
    # 5. Self-Healing Customer & Voucher Balance Checker
    # ------------------------------------------------------------------
    def check_customer_balances(
        self, db: Session, pump_id: int
    ) -> list[dict[str, Any]]:
        customers = list(
            db.scalars(
                select(Customer).where(
                    Customer.pump_id == pump_id, Customer.is_active.is_(True)
                )
            ).all()
        )
        drifted: list[dict[str, Any]] = []
        for c in customers:
            expected = self._compute_expected_customer_balance(db, c)
            actual = _q(c.outstanding_balance)
            diff = (actual - expected).quantize(Decimal("0.01"))
            if abs(diff) > Decimal("0.01"):
                drifted.append(
                    {
                        "customer_uuid": str(c.uuid),
                        "customer_name": c.name,
                        "stored_balance": float(actual),
                        "expected_balance": float(expected),
                        "difference": float(diff),
                    }
                )
        return drifted

    def _compute_expected_customer_balance(
        self, db: Session, customer: Customer
    ) -> Decimal:
        # Unpaid balance across active CREDIT / SPLIT vouchers
        vouchers = list(
            db.scalars(
                select(Voucher).where(
                    Voucher.customer_id == customer.id,
                    Voucher.is_active.is_(True),
                    Voucher.payment_mode.in_([PaymentMode.CREDIT, PaymentMode.SPLIT]),
                )
            ).all()
        )
        unpaid_vouchers = Decimal("0.00")
        for v in vouchers:
            if v.payment_mode == PaymentMode.CREDIT:
                unpaid_vouchers += max(
                    Decimal("0.00"), _q(v.total_amount) - _q(v.amount_paid)
                )
            elif v.payment_mode == PaymentMode.SPLIT:
                credit_part = _q(v.credit_amount)
                # Subtract any portion of credit_part paid via allocations
                allocated = _q(
                    db.scalar(
                        select(
                            func.coalesce(
                                func.sum(VoucherSettlement.amount),
                                Decimal("0.00"),
                            )
                        ).where(
                            VoucherSettlement.voucher_id == v.id,
                            VoucherSettlement.is_active.is_(True),
                        )
                    )
                )
                unpaid_vouchers += max(Decimal("0.00"), credit_part - allocated)

        # Unallocated advances from active Payments
        payments = list(
            db.scalars(
                select(Payment).where(
                    Payment.customer_id == customer.id,
                    Payment.is_active.is_(True),
                )
            ).all()
        )
        total_paid = sum((_q(p.amount) for p in payments), Decimal("0.00"))
        total_allocated = Decimal("0.00")
        if payments:
            p_ids = [p.id for p in payments]
            total_allocated = _q(
                db.scalar(
                    select(
                        func.coalesce(
                            func.sum(VoucherSettlement.amount),
                            Decimal("0.00"),
                        )
                    ).where(
                        VoucherSettlement.payment_id.in_(p_ids),
                        VoucherSettlement.is_active.is_(True),
                    )
                )
            )
        unallocated_advances = max(Decimal("0.00"), total_paid - total_allocated)
        return (
            _q(customer.opening_balance) + unpaid_vouchers - unallocated_advances
        ).quantize(Decimal("0.01"))

    def recalculate_customer_balances(
        self,
        db: Session,
        pump_id: int,
        customer_uuid: str | None = None,
        actor_id: int | None = None,
    ) -> dict[str, Any]:
        stmt = select(Customer).where(
            Customer.pump_id == pump_id, Customer.is_active.is_(True)
        )
        if customer_uuid:
            stmt = stmt.where(Customer.uuid == customer_uuid)
        customers = list(db.scalars(stmt).all())
        fixed: list[dict[str, Any]] = []
        for c in customers:
            expected = self._compute_expected_customer_balance(db, c)
            actual = _q(c.outstanding_balance)
            if abs(actual - expected) > Decimal("0.01"):
                c.outstanding_balance = expected
                fixed.append(
                    {
                        "customer_uuid": str(c.uuid),
                        "customer_name": c.name,
                        "old_balance": float(actual),
                        "new_balance": float(expected),
                    }
                )
        if fixed:
            self.audit_service.log_action(
                db,
                action="Self-Healed Customer Balances",
                target_table="customers",
                target_id=customer_uuid or "BATCH",
                actor_id=actor_id,
                new_values={"fixed_count": len(fixed)},
            )
            db.commit()
        return {"fixed_count": len(fixed), "fixed": fixed}

    # ------------------------------------------------------------------
    # 6. Books Health Check & 1-Click Fix Legacy Entries
    # ------------------------------------------------------------------
    def _find_unlinked_bank_entries(
        self, db: Session, pump_id: int, on_date: date | None = None
    ) -> list[dict[str, Any]]:
        digital_modes = [PaymentMode.UPI, PaymentMode.CARD, PaymentMode.BANK]
        results: list[dict[str, Any]] = []

        v_stmt = select(Voucher).where(
            Voucher.pump_id == pump_id,
            Voucher.is_active.is_(True),
            Voucher.payment_mode.in_(digital_modes),
            Voucher.bank_account_id.is_(None),
        )
        if on_date is not None:
            v_stmt = v_stmt.where(Voucher.invoice_date == on_date)
        for v in db.scalars(v_stmt).all():
            results.append(
                {
                    "entity": "VOUCHER",
                    "uuid": str(v.uuid),
                    "date": v.invoice_date.isoformat(),
                    "mode": v.payment_mode.value,
                    "amount": float(_q(v.total_amount)),
                    "label": v.invoice_number,
                }
            )

        p_stmt = select(Payment).where(
            Payment.pump_id == pump_id,
            Payment.is_active.is_(True),
            Payment.payment_mode.in_(digital_modes),
            Payment.bank_account_id.is_(None),
        )
        if on_date is not None:
            p_stmt = p_stmt.where(Payment.payment_date == on_date)
        for p in db.scalars(p_stmt).all():
            results.append(
                {
                    "entity": "PAYMENT",
                    "uuid": str(p.uuid),
                    "date": p.payment_date.isoformat(),
                    "mode": p.payment_mode.value,
                    "amount": float(_q(p.amount)),
                    "label": p.reference_number or str(p.uuid)[:8],
                }
            )

        i_stmt = select(Income).where(
            Income.pump_id == pump_id,
            Income.is_active.is_(True),
            Income.payment_mode.in_(digital_modes),
            Income.bank_account_id.is_(None),
        )
        if on_date is not None:
            i_stmt = i_stmt.where(Income.income_date == on_date)
        for inc in db.scalars(i_stmt).all():
            results.append(
                {
                    "entity": "INCOME",
                    "uuid": str(inc.uuid),
                    "date": inc.income_date.isoformat(),
                    "mode": inc.payment_mode.value,
                    "amount": float(_q(inc.amount)),
                    "label": inc.category or inc.description or "Register Entry",
                }
            )
        return results

    def run_books_health_check(self, db: Session, pump_id: int) -> dict[str, Any]:
        unlinked = self._find_unlinked_bank_entries(db, pump_id, on_date=None)
        drifted_customers = self.check_customer_balances(db, pump_id)

        negative_tanks = list(
            db.scalars(
                select(FuelTank).where(
                    FuelTank.pump_id == pump_id,
                    FuelTank.is_active.is_(True),
                    FuelTank.current_stock_liters < 0,
                )
            ).all()
        )
        variance_closings = list(
            db.scalars(
                select(DayClosing)
                .where(
                    DayClosing.pump_id == pump_id,
                    func.abs(DayClosing.variance) > Decimal("100.00"),
                )
                .order_by(DayClosing.closing_date.desc())
                .limit(20)
            ).all()
        )
        overdue_recurring = list(
            db.scalars(
                select(RecurringExpense).where(
                    RecurringExpense.pump_id == pump_id,
                    RecurringExpense.is_active.is_(True),
                    RecurringExpense.next_due_date < date.today(),
                )
            ).all()
        )

        issues = [
            {
                "id": "unlinked_bank",
                "title": "UPI/Bank entries missing linked Bank Account",
                "count": len(unlinked),
                "severity": "HIGH" if unlinked else "OK",
                "fix_action": "fix_legacy_entries" if unlinked else None,
                "items": unlinked[:20],
            },
            {
                "id": "drifted_customers",
                "title": "Customer balances out of sync with unpaid bills",
                "count": len(drifted_customers),
                "severity": "HIGH" if drifted_customers else "OK",
                "fix_action": "fix_customer_balances" if drifted_customers else None,
                "items": drifted_customers[:20],
            },
            {
                "id": "negative_tanks",
                "title": "Fuel tanks with negative book stock",
                "count": len(negative_tanks),
                "severity": "HIGH" if negative_tanks else "OK",
                "fix_action": None,
                "items": [
                    {
                        "tank_uuid": str(t.uuid),
                        "name": t.name,
                        "stock": float(t.current_stock_liters),
                    }
                    for t in negative_tanks
                ],
            },
            {
                "id": "closing_variances",
                "title": "Day Closings with cash variance > ±₹100",
                "count": len(variance_closings),
                "severity": "MEDIUM" if variance_closings else "OK",
                "fix_action": None,
                "items": [
                    {
                        "closing_uuid": str(dc.uuid),
                        "date": dc.closing_date.isoformat(),
                        "variance": float(_q(dc.variance)),
                    }
                    for dc in variance_closings
                ],
            },
            {
                "id": "overdue_recurring",
                "title": "Overdue recurring expenses",
                "count": len(overdue_recurring),
                "severity": "MEDIUM" if overdue_recurring else "OK",
                "fix_action": None,
                "items": [
                    {
                        "uuid": str(r.uuid),
                        "title": r.title,
                        "due_date": r.next_due_date.isoformat(),
                        "amount": float(_q(r.amount)),
                    }
                    for r in overdue_recurring
                ],
            },
        ]
        total_issues = sum(i["count"] for i in issues)
        return {"total_issues": total_issues, "issues": issues}

    def fix_legacy_entries(
        self,
        db: Session,
        pump_id: int,
        bank_account_uuid: str | None = None,
        on_date: date | None = None,
        actor_id: int | None = None,
    ) -> dict[str, Any]:
        # Resolve target bank account (given or primary active bank account)
        if bank_account_uuid:
            target_bank = self.bank_service.get_by_uuid(db, bank_account_uuid)
        else:
            target_bank = db.scalars(
                select(BankAccount)
                .where(
                    BankAccount.pump_id == pump_id, BankAccount.is_active.is_(True)
                )
                .order_by(BankAccount.id.asc())
                .limit(1)
            ).first()
            if target_bank is None:
                return {
                    "fixed_count": 0,
                    "message": "No active Bank Account found to link legacy entries.",
                }

        digital_modes = [PaymentMode.UPI, PaymentMode.CARD, PaymentMode.BANK]
        fixed_vouchers = 0
        fixed_payments = 0
        fixed_incomes = 0

        v_stmt = select(Voucher).where(
            Voucher.pump_id == pump_id,
            Voucher.is_active.is_(True),
            Voucher.payment_mode.in_(digital_modes),
            Voucher.bank_account_id.is_(None),
        )
        if on_date is not None:
            v_stmt = v_stmt.where(Voucher.invoice_date == on_date)
        for v in db.scalars(v_stmt).all():
            v.bank_account_id = target_bank.id
            self.bank_service.sync_from_entity(
                db,
                bank_account_uuid=str(target_bank.uuid),
                amount=_q(v.total_amount),
                transaction_type="INCOME",
                transaction_date=v.invoice_date,
                reference_number=f"VCH-{v.id}",
                remarks=f"Legacy backfill: Voucher {v.invoice_number}",
                pump_id=pump_id,
            )
            fixed_vouchers += 1

        p_stmt = select(Payment).where(
            Payment.pump_id == pump_id,
            Payment.is_active.is_(True),
            Payment.payment_mode.in_(digital_modes),
            Payment.bank_account_id.is_(None),
        )
        if on_date is not None:
            p_stmt = p_stmt.where(Payment.payment_date == on_date)
        for p in db.scalars(p_stmt).all():
            p.bank_account_id = target_bank.id
            self.bank_service.sync_from_entity(
                db,
                bank_account_uuid=str(target_bank.uuid),
                amount=_q(p.amount),
                transaction_type="INCOME",
                transaction_date=p.payment_date,
                reference_number=f"PAY-{p.id}",
                remarks="Legacy backfill: Customer Payment",
                pump_id=pump_id,
            )
            fixed_payments += 1

        i_stmt = select(Income).where(
            Income.pump_id == pump_id,
            Income.is_active.is_(True),
            Income.payment_mode.in_(digital_modes),
            Income.bank_account_id.is_(None),
        )
        if on_date is not None:
            i_stmt = i_stmt.where(Income.income_date == on_date)
        for inc in db.scalars(i_stmt).all():
            inc.bank_account_id = target_bank.id
            txn_type = "EXPENSE" if inc.kind == IncomeKind.EXPENSE else "INCOME"
            self.bank_service.sync_from_entity(
                db,
                bank_account_uuid=str(target_bank.uuid),
                amount=_q(inc.amount),
                transaction_type=txn_type,
                transaction_date=inc.income_date,
                reference_number=f"INC-{inc.id}",
                remarks=f"Legacy backfill: {inc.category or 'Register'}",
                pump_id=pump_id,
            )
            fixed_incomes += 1

        total = fixed_vouchers + fixed_payments + fixed_incomes
        if total > 0:
            self.audit_service.log_action(
                db,
                action="Fixed & Synced Legacy Entries",
                target_table="bank_accounts",
                target_id=str(target_bank.uuid),
                actor_id=actor_id,
                new_values={
                    "vouchers": fixed_vouchers,
                    "payments": fixed_payments,
                    "incomes": fixed_incomes,
                },
            )
            db.commit()

        return {
            "fixed_count": total,
            "vouchers": fixed_vouchers,
            "payments": fixed_payments,
            "incomes": fixed_incomes,
            "bank_account_name": f"{target_bank.bank_name} ({target_bank.account_name})",
        }

    # ------------------------------------------------------------------
    # 7. Pre-Export Data Integrity Audit (Tally / CA Reports)
    # ------------------------------------------------------------------
    def pre_export_integrity_audit(
        self, db: Session, pump_id: int, start_date: date, end_date: date
    ) -> dict[str, Any]:
        unlinked = [
            e
            for e in self._find_unlinked_bank_entries(db, pump_id)
            if start_date.isoformat() <= e["date"] <= end_date.isoformat()
        ]
        pending_ocr = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.pump_id == pump_id,
                Voucher.is_active.is_(True),
                Voucher.invoice_date >= start_date,
                Voucher.invoice_date <= end_date,
                Voucher.verification_status == VerificationStatus.PENDING,
            )
        ) or 0

        # Check days with vouchers/readings in range that are not locked
        voucher_dates = set(
            db.scalars(
                select(Voucher.invoice_date)
                .where(
                    Voucher.pump_id == pump_id,
                    Voucher.is_active.is_(True),
                    Voucher.invoice_date >= start_date,
                    Voucher.invoice_date <= end_date,
                )
                .distinct()
            ).all()
        )
        closed_dates = set(
            db.scalars(
                select(DayClosing.closing_date).where(
                    DayClosing.pump_id == pump_id,
                    DayClosing.closing_date >= start_date,
                    DayClosing.closing_date <= end_date,
                    DayClosing.status.in_(["CLOSED", "LOCKED"]),
                )
            ).all()
        )
        unlocked_days = sorted(
            d.isoformat() for d in voucher_dates if d not in closed_dates
        )

        # Check active fuel types with no PriceSchedule at all
        active_fuels = set(
            db.scalars(
                select(Nozzle.fuel_type)
                .where(Nozzle.pump_id == pump_id, Nozzle.is_active.is_(True))
                .distinct()
            ).all()
        )
        scheduled_fuels = set(
            db.scalars(
                select(PriceSchedule.fuel_type)
                .where(PriceSchedule.pump_id == pump_id)
                .distinct()
            ).all()
        )
        missing_rates = [
            f.value if hasattr(f, "value") else str(f)
            for f in active_fuels
            if f not in scheduled_fuels
        ]

        checks = [
            {
                "id": "unlinked_banks",
                "title": "Unlinked UPI/Bank Entries",
                "count": len(unlinked),
                "passed": len(unlinked) == 0,
            },
            {
                "id": "pending_ocr",
                "title": "Unreviewed OCR Bills",
                "count": pending_ocr,
                "passed": pending_ocr == 0,
            },
            {
                "id": "unlocked_days",
                "title": "Unlocked Business Days",
                "count": len(unlocked_days),
                "passed": len(unlocked_days) == 0,
                "dates": unlocked_days[:15],
            },
            {
                "id": "missing_rates",
                "title": "Fuel Types Missing Price Schedule",
                "count": len(missing_rates),
                "passed": len(missing_rates) == 0,
                "fuels": missing_rates,
            },
        ]
        return {
            "ready": all(c["passed"] for c in checks),
            "checks": checks,
        }

    # ------------------------------------------------------------------
    # 8. Live Bank & Cash Flow Timeline (Single Feed of Every Rupee)
    # ------------------------------------------------------------------
    def get_daily_cash_bank_timeline(
        self, db: Session, target_date: date, pump_id: int
    ) -> dict[str, Any]:
        events: list[dict[str, Any]] = []

        # Vouchers (Fuel / Lube)
        for v in db.scalars(
            select(Voucher).where(
                Voucher.pump_id == pump_id,
                Voucher.invoice_date == target_date,
                Voucher.is_active.is_(True),
            )
        ).all():
            events.append(
                {
                    "id": f"VCH-{v.id}",
                    "uuid": str(v.uuid),
                    "timestamp": (v.created_at.isoformat() if v.created_at else target_date.isoformat()),
                    "category": "FUEL_SALE",
                    "direction": "IN" if v.payment_mode != PaymentMode.CREDIT else "CREDIT",
                    "mode": v.payment_mode.value,
                    "amount": float(_q(v.total_amount)),
                    "title": f"Voucher {v.invoice_number}",
                    "subtitle": v.customer_name or v.vehicle_number or v.fuel_type.value,
                    "bank_account_id": v.bank_account_id,
                }
            )

        # Customer Payments
        for p in db.scalars(
            select(Payment).where(
                Payment.pump_id == pump_id,
                Payment.payment_date == target_date,
                Payment.is_active.is_(True),
            )
        ).all():
            events.append(
                {
                    "id": f"PAY-{p.id}",
                    "uuid": str(p.uuid),
                    "timestamp": (p.created_at.isoformat() if p.created_at else target_date.isoformat()),
                    "category": "CUSTOMER_PAYMENT",
                    "direction": "IN",
                    "mode": p.payment_mode.value,
                    "amount": float(_q(p.amount)),
                    "title": "Customer Payment",
                    "subtitle": p.reference_number or p.remarks or "Credit Recovery",
                    "bank_account_id": p.bank_account_id,
                }
            )

        # Income / Expenses / Deposits
        for inc in db.scalars(
            select(Income).where(
                Income.pump_id == pump_id,
                Income.income_date == target_date,
                Income.is_active.is_(True),
            )
        ).all():
            direction = "OUT" if inc.kind == IncomeKind.EXPENSE else "IN"
            events.append(
                {
                    "id": f"INC-{inc.id}",
                    "uuid": str(inc.uuid),
                    "timestamp": (inc.created_at.isoformat() if inc.created_at else target_date.isoformat()),
                    "category": inc.kind.value,
                    "direction": direction,
                    "mode": inc.payment_mode.value,
                    "amount": float(_q(inc.amount)),
                    "title": inc.category or inc.kind.value,
                    "subtitle": inc.description or "",
                    "bank_account_id": inc.bank_account_id,
                }
            )

        # Bank Transactions (Deposits / Transfers / Tanker RTGS)
        for bt in db.scalars(
            select(BankTransaction).where(
                BankTransaction.pump_id == pump_id,
                BankTransaction.transaction_date == target_date,
            )
        ).all():
            # Skip already represented entity-synced txns to avoid duplicate visual rows
            ref = bt.reference_number or ""
            if ref.startswith(("VCH-", "PAY-", "INC-")):
                continue
            direction = (
                "IN"
                if bt.transaction_type in ("INCOME", "DEPOSIT", "TRANSFER_IN", "OPENING_BALANCE")
                else "OUT"
            )
            events.append(
                {
                    "id": f"BNK-{bt.id}",
                    "uuid": str(bt.uuid),
                    "timestamp": (bt.created_at.isoformat() if bt.created_at else target_date.isoformat()),
                    "category": f"BANK_{bt.transaction_type}",
                    "direction": direction,
                    "mode": "BANK",
                    "amount": float(_q(bt.amount)),
                    "title": bt.transaction_type.replace("_", " ").title(),
                    "subtitle": bt.remarks or bt.reference_number or "",
                    "bank_account_id": bt.bank_account_id,
                }
            )

        events.sort(key=lambda e: e["timestamp"], reverse=True)
        return {"date": target_date.isoformat(), "count": len(events), "events": events}
