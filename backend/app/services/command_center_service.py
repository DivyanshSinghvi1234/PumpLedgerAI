from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.fuel_tank import FuelTank
from app.models.purchase_indent import IndentStatus, PurchaseIndent
from app.models.recurring_expense import RecurringExpense
from app.models.stock_variance import StockVariance
from app.services.bank_account_service import BankAccountService
from app.services.employee_service import EmployeeService
from app.services.price_schedule_service import PriceScheduleService
from app.services.report_service import ReportService


class CommandCenterService:
    """Aggregates real-time P&L, Balance Sheet snapshot, and 14-day Cashflow Forecast
    into a single owner financial command center."""

    def __init__(self) -> None:
        self.report_service = ReportService()
        self.bank_service = BankAccountService()
        self.employee_service = EmployeeService()
        self.price_service = PriceScheduleService()

    def _stock_loss_value(
        self,
        db: Session,
        start_date: date,
        end_date: date,
        tank_rates: dict[int, Decimal],
    ) -> Decimal:
        variances = db.scalars(
            select(StockVariance).where(
                StockVariance.variance_date >= start_date,
                StockVariance.variance_date <= end_date,
                StockVariance.variance_liters < 0,
            )
        ).all()
        total = Decimal("0.00")
        for v in variances:
            rate = tank_rates.get(v.tank_id, Decimal("0.00"))
            loss_liters = Decimal(str(abs(float(v.variance_liters or 0.0))))
            total += (loss_liters * rate).quantize(Decimal("0.01"))
        return total.quantize(Decimal("0.01"))

    def get_summary(self, db: Session, pump_id: int, forecast_days: int = 14) -> dict:
        today = date.today()
        month_start = date(today.year, today.month, 1)
        horizon_end = today + timedelta(days=forecast_days)

        # 1. Tanks & Valuation Rates (prefer avg_cost_per_liter, fallback to active selling rate)
        tanks = list(
            db.scalars(select(FuelTank).where(FuelTank.is_active.is_(True))).all()
        )
        tank_rates: dict[int, Decimal] = {}
        fuel_stock_value = Decimal("0.00")
        total_fuel_liters = 0.0
        for t in tanks:
            rate = (
                Decimal(str(t.avg_cost_per_liter))
                if t.avg_cost_per_liter and t.avg_cost_per_liter > 0
                else (self.price_service.get_active_rate(db, t.fuel_type) or Decimal("0.00"))
            )
            tank_rates[t.id] = rate
            stock_l = max(0.0, float(t.current_stock_liters or 0.0))
            total_fuel_liters += stock_l
            fuel_stock_value += (Decimal(str(stock_l)) * rate).quantize(Decimal("0.01"))

        # 2. Today & MTD True P&L (including stock loss value)
        pnl_today = self.report_service.pnl_report(db, from_date=today, to_date=today)
        pnl_mtd = self.report_service.pnl_report(db, from_date=month_start, to_date=today)
        loss_today = self._stock_loss_value(db, today, today, tank_rates)
        loss_mtd = self._stock_loss_value(db, month_start, today, tank_rates)

        true_net_today = (pnl_today.net_profit - loss_today).quantize(Decimal("0.01"))
        true_net_mtd = (pnl_mtd.net_profit - loss_mtd).quantize(Decimal("0.01"))

        # 3. Live Balance Sheet Snapshot
        liquid = self.bank_service.get_liquid_funds_summary(db, pump_id)
        cash_in_hand = Decimal(str(liquid["total_cash_available"])).quantize(Decimal("0.01"))
        bank_balance = Decimal(str(liquid["total_bank_balance"])).quantize(Decimal("0.01"))
        total_liquid = Decimal(str(liquid["total_liquid_funds"])).quantize(Decimal("0.01"))

        receivables = db.scalar(
            select(func.coalesce(func.sum(Customer.outstanding_balance), Decimal("0.00"))).where(
                Customer.is_active.is_(True),
                Customer.outstanding_balance > 0,
            )
        ) or Decimal("0.00")
        receivables = Decimal(str(receivables)).quantize(Decimal("0.01"))

        omc_payables_raw = db.scalar(
            select(func.coalesce(func.sum(PurchaseIndent.total_invoice_amount), 0.0)).where(
                PurchaseIndent.is_active.is_(True),
                PurchaseIndent.status == IndentStatus.DELIVERED,
                PurchaseIndent.payment_mode == "CREDIT",
            )
        ) or 0.0
        omc_payables = Decimal(str(omc_payables_raw)).quantize(Decimal("0.01"))

        net_working_capital = (
            total_liquid + receivables + fuel_stock_value - omc_payables
        ).quantize(Decimal("0.01"))

        # 4. 14-Day Cashflow Forecast
        upcoming_outflows: list[dict] = []
        total_outflows = Decimal("0.00")

        # 4a. Upcoming recurring expenses
        rec_rows = db.scalars(
            select(RecurringExpense).where(
                RecurringExpense.is_active.is_(True),
                RecurringExpense.next_due_date <= horizon_end,
            )
        ).all()
        for r in rec_rows:
            amt = Decimal(str(r.amount)).quantize(Decimal("0.01"))
            total_outflows += amt
            upcoming_outflows.append(
                {
                    "type": "RECURRING_BILL",
                    "title": r.title,
                    "due_date": r.next_due_date.isoformat(),
                    "amount": float(amt),
                }
            )

        # 4b. Upcoming OMC Purchase Indents
        indents = db.scalars(
            select(PurchaseIndent).where(
                PurchaseIndent.is_active.is_(True),
                PurchaseIndent.status.in_([IndentStatus.INDENTED, IndentStatus.DISPATCHED]),
                PurchaseIndent.expected_delivery_date <= horizon_end,
            )
        ).all()
        for ind in indents:
            est = Decimal(str(ind.total_invoice_amount or 0.0))
            if est <= 0 and ind.procurement_cost_per_liter:
                est = Decimal(str(ind.ordered_liters * ind.procurement_cost_per_liter))
            est = est.quantize(Decimal("0.01"))
            if est > 0:
                total_outflows += est
                upcoming_outflows.append(
                    {
                        "type": "TANKER_INDENT",
                        "title": f"{ind.omc_company.value} {ind.fuel_type.value} ({ind.ordered_liters:,.0f}L)",
                        "due_date": ind.expected_delivery_date.isoformat(),
                        "amount": float(est),
                    }
                )

        # 4c. Unpaid monthly payroll
        billing_month = today.strftime("%Y-%m")
        payroll = self.employee_service.payroll_preview(db, billing_month)
        unpaid_payroll = sum(
            (r.net_payable for r in payroll.rows if not r.already_paid_this_month),
            Decimal("0.00"),
        ).quantize(Decimal("0.01"))
        if unpaid_payroll > Decimal("0.00"):
            total_outflows += unpaid_payroll
            upcoming_outflows.append(
                {
                    "type": "PAYROLL",
                    "title": f"Staff Payroll ({billing_month})",
                    "due_date": today.isoformat(),
                    "amount": float(unpaid_payroll),
                }
            )

        upcoming_outflows.sort(key=lambda x: x["due_date"])
        projected_liquid = (total_liquid - total_outflows).quantize(Decimal("0.01"))

        return {
            "as_of": today.isoformat(),
            "forecast_days": forecast_days,
            "pnl_today": {
                "fuel_revenue": float(pnl_today.fuel_revenue),
                "fuel_gross_margin": float(pnl_today.fuel_gross_margin),
                "other_income": float(pnl_today.other_income),
                "total_expenses": float(pnl_today.total_expenses),
                "stock_loss_value": float(loss_today),
                "true_net_profit": float(true_net_today),
            },
            "pnl_mtd": {
                "fuel_revenue": float(pnl_mtd.fuel_revenue),
                "fuel_gross_margin": float(pnl_mtd.fuel_gross_margin),
                "other_income": float(pnl_mtd.other_income),
                "total_expenses": float(pnl_mtd.total_expenses),
                "stock_loss_value": float(loss_mtd),
                "true_net_profit": float(true_net_mtd),
                "expense_by_category": [
                    {"category": c.category, "amount": float(c.amount)}
                    for c in pnl_mtd.expense_by_category
                ],
            },
            "balance_sheet": {
                "cash_in_hand": float(cash_in_hand),
                "bank_balance": float(bank_balance),
                "total_liquid_funds": float(total_liquid),
                "customer_receivables": float(receivables),
                "fuel_stock_liters": round(total_fuel_liters, 2),
                "fuel_stock_value": float(fuel_stock_value),
                "omc_payables": float(omc_payables),
                "net_working_capital": float(net_working_capital),
            },
            "cashflow_forecast": {
                "total_upcoming_outflows": float(total_outflows),
                "projected_liquid_balance": float(projected_liquid),
                "low_balance_warning": projected_liquid < Decimal("50000.00"),
                "items": upcoming_outflows,
            },
        }
