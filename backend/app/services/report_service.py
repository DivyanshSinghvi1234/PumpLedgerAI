from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories.report_repository import ReportRepository
from app.schemas.report import (
    CustomerReportResponse,
    CustomerReportRow,
    DailyReportResponse,
    DebtorAgingResponse,
    DebtorAgingRow,
    LedgerReportResponse,
    LedgerReportRow,
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
