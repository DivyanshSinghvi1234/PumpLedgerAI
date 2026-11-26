from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import CustomerNotFoundError
from app.models.customer import Customer
from app.models.voucher import Voucher
from app.repositories.report_repository import ReportRepository
from app.schemas.report import (
    CustomerReportResponse,
    CustomerReportRow,
    DailyReportResponse,
    DebtorAgingResponse,
    DebtorAgingRow,
    GSTInvoiceHSNSummaryRow,
    GSTInvoiceLineItem,
    GSTInvoiceVehicleSubtotalRow,
    LedgerReportResponse,
    LedgerReportRow,
    MonthlyGSTInvoiceResponse,
    PnLCategoryRow,
    PnLReportResponse,
    VoucherReportResponse,
    VoucherReportRow,
)
from app.services.ledger_service import LedgerService
from app.services.balance_service import BalanceService


class ReportService:

    def __init__(self) -> None:
        self.repository = ReportRepository()
        self.ledger_service = LedgerService()
        self.balance_service = BalanceService()

    # -----------------------------------
    # Voucher Report
    # -----------------------------------

    def voucher_report(
        self,
        db: Session,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
        fuel_type: str | None = None,
        payment_mode: str | None = None,
        verification_status: str | None = None,
    ) -> VoucherReportResponse:

        rows, totals = self.repository.voucher_report(
            db,
            from_date=from_date,
            to_date=to_date,
            fuel_type=fuel_type,
            payment_mode=payment_mode,
            verification_status=verification_status,
        )

        return VoucherReportResponse(
            rows=[
                VoucherReportRow.model_validate(v)
                for v in rows
            ],
            total_amount=totals["total_amount"],
            total_quantity=totals["total_quantity"],
            count=totals["count"],
        )

    def voucher_report_csv(
        self,
        db: Session,
        **filters,
    ) -> tuple[list[str], list[list]]:

        report = self.voucher_report(db, **filters)

        header = [
            "Invoice Number",
            "Invoice Date",
            "Customer",
            "Vehicle",
            "Fuel",
            "Quantity (L)",
            "Rate/L",
            "Total Amount",
            "Payment Mode",
            "Status",
        ]

        rows = [
            [
                r.invoice_number,
                r.invoice_date.isoformat(),
                r.customer_name or "",
                r.vehicle_number or "",
                r.fuel_type.value,
                str(r.quantity_liters),
                str(r.rate_per_liter),
                str(r.total_amount),
                r.payment_mode.value,
                r.verification_status.value,
            ]
            for r in report.rows
        ]

        return header, rows

    # -----------------------------------
    # Customer Report
    # -----------------------------------

    def customer_report(
        self,
        db: Session,
        *,
        search: str | None = None,
    ) -> CustomerReportResponse:

        rows, _ = self.repository.customer_report(
            db,
            search=search,
        )

        # Report the live balances and derive the total from the same figures
        # so the report agrees with the customer/vehicle views exactly.
        balances = self.balance_service.customer_outstanding_bulk(
            db,
            [c.id for c in rows],
        )
        for c in rows:
            c.outstanding_balance = balances[c.id]

        total_outstanding = sum(
            balances.values(),
            Decimal("0.00"),
        )

        return CustomerReportResponse(
            rows=[
                CustomerReportRow.model_validate(c)
                for c in rows
            ],
            total_outstanding=total_outstanding,
            count=len(rows),
        )

    def customer_report_csv(
        self,
        db: Session,
        **filters,
    ) -> tuple[list[str], list[list]]:

        report = self.customer_report(db, **filters)

        header = [
            "Code",
            "Name",
            "Mobile",
            "GST",
            "Credit Limit",
            "Outstanding",
        ]

        rows = [
            [
                r.customer_code or "",
                r.name,
                r.mobile or "",
                r.gst_number or "",
                str(r.credit_limit),
                str(r.outstanding_balance),
            ]
            for r in report.rows
        ]

        return header, rows

    # -----------------------------------
    # Ledger Report (per-customer statement)
    # -----------------------------------

    def ledger_report(
        self,
        db: Session,
        customer_uuid: str,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> LedgerReportResponse:

        data = self.ledger_service.statement_for_customer(
            db,
            customer_uuid,
            from_date=from_date,
            to_date=to_date,
        )

        return LedgerReportResponse(
            customer_uuid=data["customer_uuid"],
            customer_name=data["customer_name"],
            from_date=data["from_date"],
            to_date=data["to_date"],
            opening_balance=data["opening_balance"],
            closing_balance=data["closing_balance"],
            rows=[
                LedgerReportRow(**row)
                for row in data["rows"]
            ],
            count=data["count"],
        )

    def ledger_report_csv(
        self,
        db: Session,
        customer_uuid: str,
        **filters,
    ) -> tuple[list[str], list[list]]:

        report = self.ledger_report(
            db,
            customer_uuid,
            **filters,
        )

        header = [
            "Date",
            "Type",
            "Debit",
            "Credit",
            "Balance",
            "Remarks",
        ]

        rows = []
        for r in report.rows:
            is_debit = r.signed_amount >= 0
            rows.append(
                [
                    r.entry_date.isoformat(),
                    r.entry_type,
                    str(r.amount) if is_debit else "",
                    str(r.amount) if not is_debit else "",
                    str(r.balance_after),
                    r.remarks or "",
                ]
            )

        return header, rows

    # -----------------------------------
    # Daily Sales
    # -----------------------------------

    def daily_sales(
        self,
        db: Session,
        *,
        on_date: date,
    ) -> DailyReportResponse:

        data = self.repository.daily_sales(db, on_date=on_date)

        return DailyReportResponse(**data)

    def daily_sales_csv(
        self,
        db: Session,
        *,
        on_date: date,
    ) -> tuple[list[str], list[list]]:

        report = self.daily_sales(db, on_date=on_date)

        header = ["Metric", "Value"]

        rows = [
            ["Date", report.report_date.isoformat()],
            ["Total Sales", str(report.total_sales)],
            ["Total Vouchers", str(report.total_vouchers)],
            ["Petrol Sales", str(report.petrol_sales)],
            ["Diesel Sales", str(report.diesel_sales)],
            ["Cash Sales", str(report.cash_sales)],
            ["UPI Sales", str(report.upi_sales)],
            ["Credit Sales", str(report.credit_sales)],
            ["Average Invoice", str(report.average_invoice)],
        ]

        return header, rows

    # -----------------------------------
    # Debtor Aging
    # -----------------------------------

    def debtor_aging_report(
        self,
        db: Session,
        *,
        as_of: date | None = None,
    ) -> DebtorAgingResponse:
        """Bucket each debtor's open invoice balances by age.

        Age = as_of − invoice_date; owed per invoice = voucher.balance_due.
        Buckets: 0-15, 16-30, 31-60, 60+ days."""

        as_of = as_of or date.today()

        # Accumulate per-customer buckets while walking open vouchers.
        by_customer: dict[str, dict] = {}

        for voucher, customer in self.repository.open_credit_vouchers(db):
            due = voucher.balance_due
            if due <= Decimal("0.00"):
                continue

            age = (as_of - voucher.invoice_date).days

            row = by_customer.setdefault(
                customer.uuid,
                {
                    "customer_uuid": customer.uuid,
                    "customer_name": customer.name,
                    "mobile": customer.mobile,
                    "bucket_0_15": Decimal("0.00"),
                    "bucket_16_30": Decimal("0.00"),
                    "bucket_31_60": Decimal("0.00"),
                    "bucket_60_plus": Decimal("0.00"),
                },
            )

            if age <= 15:
                row["bucket_0_15"] += due
            elif age <= 30:
                row["bucket_16_30"] += due
            elif age <= 60:
                row["bucket_31_60"] += due
            else:
                row["bucket_60_plus"] += due

        rows: list[DebtorAgingRow] = []
        totals = {
            "0_15": Decimal("0.00"),
            "16_30": Decimal("0.00"),
            "31_60": Decimal("0.00"),
            "60_plus": Decimal("0.00"),
        }

        for data in by_customer.values():
            row_total = (
                data["bucket_0_15"]
                + data["bucket_16_30"]
                + data["bucket_31_60"]
                + data["bucket_60_plus"]
            )
            totals["0_15"] += data["bucket_0_15"]
            totals["16_30"] += data["bucket_16_30"]
            totals["31_60"] += data["bucket_31_60"]
            totals["60_plus"] += data["bucket_60_plus"]

            rows.append(
                DebtorAgingRow(total_outstanding=row_total, **data)
            )

        # Largest debtors first — most relevant for recovery calls.
        rows.sort(key=lambda r: r.total_outstanding, reverse=True)

        grand_total = (
            totals["0_15"] + totals["16_30"] + totals["31_60"] + totals["60_plus"]
        )

        return DebtorAgingResponse(
            as_of_date=as_of,
            rows=rows,
            total_outstanding=grand_total,
            total_0_15=totals["0_15"],
            total_16_30=totals["16_30"],
            total_31_60=totals["31_60"],
            total_60_plus=totals["60_plus"],
            count=len(rows),
        )

    def debtor_aging_csv(
        self,
        db: Session,
        *,
        as_of: date | None = None,
    ) -> tuple[list[str], list[list]]:

        report = self.debtor_aging_report(db, as_of=as_of)

        header = [
            "Customer",
            "Mobile",
            "0-15 days",
            "16-30 days",
            "31-60 days",
            "60+ days",
            "Total Outstanding",
        ]

        rows = [
            [
                r.customer_name,
                r.mobile or "",
                str(r.bucket_0_15),
                str(r.bucket_16_30),
                str(r.bucket_31_60),
                str(r.bucket_60_plus),
                str(r.total_outstanding),
            ]
            for r in report.rows
        ]

        return header, rows

    # -----------------------------------
    # Consolidated Monthly GST Tax Invoice
    # -----------------------------------

    _HSN_MAP = {
        "PETROL": "27101241",
        "SPEED": "27101241",
        "DIESEL": "27101944",
        "LUBRICANT": "27101990",
    }

    def monthly_gst_invoice(
        self,
        db: Session,
        customer_uuid: str,
        *,
        billing_month: str | None = None,
    ) -> MonthlyGSTInvoiceResponse:
        customer = db.scalar(
            select(Customer).where(
                Customer.uuid == customer_uuid,
                Customer.is_active.is_(True),
            )
        )
        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        if billing_month:
            try:
                year_str, month_str = billing_month.split("-")
                year, month = int(year_str), int(month_str)
                if not (1 <= month <= 12):
                    raise ValueError
            except ValueError as exc:
                raise ValueError("billing_month must be in YYYY-MM format.") from exc
        else:
            today = date.today()
            year, month = today.year, today.month
            billing_month = f"{year:04d}-{month:02d}"

        _, last_day = monthrange(year, month)
        period_start = date(year, month, 1)
        period_end = date(year, month, last_day)

        vouchers = db.scalars(
            select(Voucher)
            .options(selectinload(Voucher.items))
            .where(
                Voucher.customer_id == customer.id,
                Voucher.is_active.is_(True),
                Voucher.invoice_date >= period_start,
                Voucher.invoice_date <= period_end,
            )
            .order_by(Voucher.invoice_date.asc(), Voucher.id.asc())
        ).all()

        hsn_buckets: dict[str, dict] = {}
        vehicle_buckets: dict[str, dict] = {}
        line_items: list[GSTInvoiceLineItem] = []
        total_liters = Decimal("0.00")
        grand_total = Decimal("0.00")

        def _record_line(
            v: Voucher,
            veh: str,
            ftype: str,
            qty: Decimal,
            rate: Decimal,
            amt: Decimal,
        ) -> None:
            nonlocal total_liters, grand_total
            hsn = self._HSN_MAP.get(ftype, "27101990")
            total_liters += qty
            grand_total += amt
            vehicle_buckets[veh]["total_liters"] += qty
            vehicle_buckets[veh]["total_amount"] += amt

            if ftype not in hsn_buckets:
                hsn_buckets[ftype] = {
                    "fuel_type": ftype,
                    "hsn_code": hsn,
                    "total_liters": Decimal("0.00"),
                    "taxable_amount": Decimal("0.00"),
                }
            hsn_buckets[ftype]["total_liters"] += qty
            hsn_buckets[ftype]["taxable_amount"] += amt

            line_items.append(
                GSTInvoiceLineItem(
                    invoice_date=v.invoice_date,
                    invoice_number=v.invoice_number,
                    vehicle_number=veh,
                    fuel_type=ftype,
                    hsn_code=hsn,
                    quantity_liters=qty,
                    rate_per_liter=rate,
                    total_amount=amt,
                )
            )

        for v in vouchers:
            veh = (v.vehicle_number or "UNASSIGNED").strip().upper()
            v_items = v.items if getattr(v, "items", None) else []

            if veh not in vehicle_buckets:
                vehicle_buckets[veh] = {
                    "vehicle_number": veh,
                    "slip_count": 0,
                    "total_liters": Decimal("0.00"),
                    "total_amount": Decimal("0.00"),
                }
            vehicle_buckets[veh]["slip_count"] += 1

            entries = v_items if v_items else [v]
            for it in entries:
                ftype = it.fuel_type.value if hasattr(it.fuel_type, "value") else str(it.fuel_type)
                _record_line(
                    v,
                    veh,
                    ftype,
                    Decimal(str(it.quantity_liters or 0)),
                    Decimal(str(it.rate_per_liter or 0)),
                    Decimal(str(it.total_amount or 0)),
                )

        cust_code = customer.customer_code or f"CUST{customer.id:06d}"
        invoice_number = f"GST-{year:04d}{month:02d}-{cust_code}"

        return MonthlyGSTInvoiceResponse(
            customer_uuid=customer.uuid,
            customer_name=customer.name,
            customer_code=customer.customer_code,
            gst_number=customer.gst_number,
            address=customer.address,
            mobile=customer.mobile,
            billing_month=billing_month,
            invoice_number=invoice_number,
            period_start=period_start,
            period_end=period_end,
            hsn_summary=[GSTInvoiceHSNSummaryRow(**row) for row in hsn_buckets.values()],
            vehicle_subtotals=[
                GSTInvoiceVehicleSubtotalRow(**row)
                for row in sorted(
                    vehicle_buckets.values(),
                    key=lambda r: r["total_amount"],
                    reverse=True,
                )
            ],
            line_items=line_items,
            total_liters=total_liters,
            grand_total=grand_total,
            slip_count=len(vouchers),
        )

    # -----------------------------------
    # Daily & Monthly Profit & Loss (P&L)
    # -----------------------------------

    def pnl_report(
        self,
        db: Session,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> PnLReportResponse:
        from datetime import datetime, timezone
        from app.core.enums import IncomeKind
        from app.models.fuel_tank import FuelTank, TankerDelivery
        from app.models.income import Income
        from app.models.nozzle import Nozzle
        from app.models.nozzle_reading import NozzleReading
        from app.models.shift_settlement import ShiftSettlement
        from app.services.price_schedule_service import PriceScheduleService
        from app.services.pump_setting_service import PumpSettingService

        today = date.today()
        start = from_date or date(today.year, today.month, 1)
        end = to_date or today

        vouchers = db.scalars(
            select(Voucher)
            .options(selectinload(Voucher.items))
            .where(
                Voucher.is_active.is_(True),
                Voucher.invoice_date >= start,
                Voucher.invoice_date <= end,
            )
        ).all()

        # Latest procurement rate per fuel type
        proc_rates: dict[str, Decimal] = {}
        deliveries = db.execute(
            select(TankerDelivery.procurement_rate, FuelTank.fuel_type)
            .join(FuelTank, TankerDelivery.tank_id == FuelTank.id)
            .where(
                TankerDelivery.is_active.is_(True),
                TankerDelivery.procurement_rate.is_not(None),
                TankerDelivery.delivery_date <= end,
            )
            .order_by(TankerDelivery.delivery_date.desc(), TankerDelivery.id.desc())
        ).all()
        for proc_rate, raw_ftype in deliveries:
            ftype = raw_ftype.value if hasattr(raw_ftype, "value") else str(raw_ftype)
            if ftype not in proc_rates and proc_rate is not None:
                proc_rates[ftype] = Decimal(str(proc_rate))

        # Dealer commission per liter configured in PumpSettings
        raw_comm = PumpSettingService().get_setting(db, "fuel_commission_rates") or {}
        commission_rates: dict[str, Decimal] = {}
        if isinstance(raw_comm, dict):
            for k, v in raw_comm.items():
                try:
                    val = Decimal(str(v or 0)).quantize(Decimal("0.01"))
                    if val > Decimal("0.00"):
                        commission_rates[str(k).upper()] = val
                except Exception:
                    continue

        voucher_liters_by_fuel: dict[str, Decimal] = {}
        voucher_rev_by_fuel: dict[str, Decimal] = {}

        for v in vouchers:
            entries = v.items if getattr(v, "items", None) else [v]
            for it in entries:
                ftype = it.fuel_type.value if hasattr(it.fuel_type, "value") else str(it.fuel_type)
                qty = Decimal(str(it.quantity_liters or 0))
                amt = Decimal(str(it.total_amount or 0))
                voucher_liters_by_fuel[ftype] = voucher_liters_by_fuel.get(ftype, Decimal("0.00")) + qty
                voucher_rev_by_fuel[ftype] = voucher_rev_by_fuel.get(ftype, Decimal("0.00")) + amt

        # Include meter-recorded fuel sales so unbilled walk-in cash fuel is never invisible in P&L
        meter_liters_by_fuel: dict[str, Decimal] = {}
        meter_rev_by_fuel: dict[str, Decimal] = {}
        price_service = PriceScheduleService()
        meter_rows = db.execute(
            select(NozzleReading, Nozzle.fuel_type)
            .join(Nozzle, NozzleReading.nozzle_id == Nozzle.id)
            .where(
                NozzleReading.reading_date >= start,
                NozzleReading.reading_date <= end,
            )
        ).all()
        rate_cache: dict[tuple[str, date], Decimal] = {}
        for reading, raw_ftype in meter_rows:
            ftype = raw_ftype.value if hasattr(raw_ftype, "value") else str(raw_ftype)
            qty = Decimal(str(reading.sales or 0))
            if qty <= Decimal("0.00"):
                continue
            cache_key = (ftype, reading.reading_date)
            if cache_key not in rate_cache:
                eod = datetime(
                    reading.reading_date.year,
                    reading.reading_date.month,
                    reading.reading_date.day,
                    23,
                    59,
                    59,
                    tzinfo=timezone.utc,
                )
                rate_cache[cache_key] = price_service.get_active_rate(db, raw_ftype, eod) or Decimal("0.00")
            rate = rate_cache[cache_key]
            meter_liters_by_fuel[ftype] = meter_liters_by_fuel.get(ftype, Decimal("0.00")) + qty
            meter_rev_by_fuel[ftype] = meter_rev_by_fuel.get(ftype, Decimal("0.00")) + (qty * rate).quantize(Decimal("0.01"))

        fuel_revenue = Decimal("0.00")
        fuel_liters = Decimal("0.00")
        fuel_cogs = Decimal("0.00")
        commission_profit = Decimal("0.00")
        used_proc = False
        used_comm = False

        all_fuels = set(voucher_liters_by_fuel.keys()) | set(meter_liters_by_fuel.keys())
        for ftype in all_fuels:
            v_qty = voucher_liters_by_fuel.get(ftype, Decimal("0.00"))
            v_rev = voucher_rev_by_fuel.get(ftype, Decimal("0.00"))
            m_qty = meter_liters_by_fuel.get(ftype, Decimal("0.00"))
            m_rev = meter_rev_by_fuel.get(ftype, Decimal("0.00"))

            qty = max(v_qty, m_qty)
            amt = max(v_rev, m_rev) if m_qty > v_qty else v_rev

            fuel_revenue += amt
            fuel_liters += qty

            comm_rate = commission_rates.get(ftype, Decimal("0.00"))
            if comm_rate > Decimal("0.00"):
                commission_profit += (qty * comm_rate).quantize(Decimal("0.01"))

            if ftype in proc_rates:
                fuel_cogs += (qty * proc_rates[ftype]).quantize(Decimal("0.01"))
                used_proc = True
            elif comm_rate > Decimal("0.00"):
                margin_amt = (qty * comm_rate).quantize(Decimal("0.01"))
                fuel_cogs += max(Decimal("0.00"), amt - margin_amt).quantize(Decimal("0.01"))
                used_comm = True

        fuel_gross_margin = (fuel_revenue - fuel_cogs).quantize(Decimal("0.01"))
        if used_proc and used_comm:
            margin_source = "MIXED"
        elif used_comm:
            margin_source = "COMMISSION"
        elif used_proc:
            margin_source = "PROCUREMENT"
        else:
            margin_source = "UNCONFIGURED"

        incomes = db.scalars(
            select(Income).where(
                Income.is_active.is_(True),
                Income.income_date >= start,
                Income.income_date <= end,
            )
        ).all()

        other_income = Decimal("0.00")
        total_expenses = Decimal("0.00")
        cat_buckets: dict[str, Decimal] = {}

        for row in incomes:
            amt = Decimal(str(row.amount or 0))
            if row.kind == IncomeKind.INCOME:
                other_income += amt
            elif row.kind == IncomeKind.EXPENSE:
                total_expenses += amt
                cat = (row.category or "General Expense").strip() or "General Expense"
                cat_buckets[cat] = cat_buckets.get(cat, Decimal("0.00")) + amt

        settlements = db.scalars(
            select(ShiftSettlement).where(
                ShiftSettlement.settlement_date >= start,
                ShiftSettlement.settlement_date <= end,
            )
        ).all()
        shift_variance = sum(
            (Decimal(str(s.variance or 0)) for s in settlements),
            Decimal("0.00"),
        )

        net_profit = (fuel_gross_margin + other_income - total_expenses + shift_variance).quantize(
            Decimal("0.01")
        )

        expense_rows = [
            PnLCategoryRow(category=k, amount=v.quantize(Decimal("0.01")))
            for k, v in sorted(cat_buckets.items(), key=lambda kv: kv[1], reverse=True)
        ]

        return PnLReportResponse(
            from_date=start,
            to_date=end,
            fuel_revenue=fuel_revenue.quantize(Decimal("0.01")),
            fuel_liters=fuel_liters.quantize(Decimal("0.01")),
            fuel_cogs=fuel_cogs.quantize(Decimal("0.01")),
            fuel_gross_margin=fuel_gross_margin,
            commission_profit=commission_profit.quantize(Decimal("0.01")),
            margin_source=margin_source,
            commission_rates=commission_rates,
            other_income=other_income.quantize(Decimal("0.01")),
            total_expenses=total_expenses.quantize(Decimal("0.01")),
            shift_variance=shift_variance.quantize(Decimal("0.01")),
            net_profit=net_profit,
            expense_by_category=expense_rows,
        )

    def cash_flow_report(
        self,
        db: Session,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> dict:
        """One-screen Money In vs. Money Out summary across Cash and Bank."""
        from sqlalchemy import func
        from app.models.payment import Payment
        from app.models.income import Income
        from app.core.enums import IncomeKind, PaymentMode

        today = date.today()
        start = from_date or date(today.year, today.month, 1)
        end = to_date or today

        # Money In
        vouchers = db.scalars(
            select(Voucher).where(
                Voucher.is_active.is_(True),
                Voucher.invoice_date >= start,
                Voucher.invoice_date <= end,
            )
        ).all()

        cash_sales = Decimal("0.00")
        digital_sales = Decimal("0.00")
        for v in vouchers:
            if v.payment_mode == PaymentMode.CASH:
                cash_sales += Decimal(str(v.total_amount or "0.00"))
            elif v.payment_mode in (PaymentMode.UPI, PaymentMode.CARD, PaymentMode.BANK):
                digital_sales += Decimal(str(v.total_amount or "0.00"))
            elif v.payment_mode == PaymentMode.SPLIT:
                cash_sales += Decimal(str(v.cash_amount or "0.00"))
                digital_sales += Decimal(str(v.upi_amount or "0.00")) + Decimal(str(v.card_amount or "0.00"))

        customer_payments = db.scalar(
            select(func.coalesce(func.sum(Payment.amount), Decimal("0.00"))).where(
                Payment.is_active.is_(True),
                Payment.payment_date >= start,
                Payment.payment_date <= end,
            )
        ) or Decimal("0.00")

        other_income = db.scalar(
            select(func.coalesce(func.sum(Income.amount), Decimal("0.00"))).where(
                Income.is_active.is_(True),
                Income.kind == IncomeKind.INCOME,
                Income.income_date >= start,
                Income.income_date <= end,
            )
        ) or Decimal("0.00")

        # Money Out
        expenses = db.scalars(
            select(Income).where(
                Income.is_active.is_(True),
                Income.kind == IncomeKind.EXPENSE,
                Income.income_date >= start,
                Income.income_date <= end,
            )
        ).all()

        fuel_lube_purchases = Decimal("0.00")
        staff_payroll = Decimal("0.00")
        operating_expenses = Decimal("0.00")
        for exp in expenses:
            amt = Decimal(str(exp.amount or "0.00"))
            cat = (exp.category or "").lower()
            if cat in ("procurement", "lubricants & def", "fuel purchase"):
                fuel_lube_purchases += amt
            elif exp.employee_id is not None or "salary" in cat or "payroll" in cat:
                staff_payroll += amt
            else:
                operating_expenses += amt

        total_in = (cash_sales + digital_sales + Decimal(str(customer_payments)) + Decimal(str(other_income))).quantize(Decimal("0.01"))
        total_out = (fuel_lube_purchases + staff_payroll + operating_expenses).quantize(Decimal("0.01"))
        net_cash_flow = (total_in - total_out).quantize(Decimal("0.01"))

        return {
            "from_date": start.isoformat(),
            "to_date": end.isoformat(),
            "money_in": {
                "cash_sales": float(cash_sales.quantize(Decimal("0.01"))),
                "digital_sales": float(digital_sales.quantize(Decimal("0.01"))),
                "customer_payments": float(Decimal(str(customer_payments)).quantize(Decimal("0.01"))),
                "other_income": float(Decimal(str(other_income)).quantize(Decimal("0.01"))),
            },
            "money_out": {
                "fuel_lube_purchases": float(fuel_lube_purchases.quantize(Decimal("0.01"))),
                "staff_payroll": float(staff_payroll.quantize(Decimal("0.01"))),
                "operating_expenses": float(operating_expenses.quantize(Decimal("0.01"))),
            },
            "total_in": float(total_in),
            "total_out": float(total_out),
            "net_cash_flow": float(net_cash_flow),
        }
