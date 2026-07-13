from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.repositories.report_repository import ReportRepository
from app.schemas.report import (
    CustomerReportResponse,
    CustomerReportRow,
    DailyReportResponse,
    LedgerReportResponse,
    LedgerReportRow,
    VoucherReportResponse,
    VoucherReportRow,
)
from app.services.ledger_service import LedgerService


class ReportService:

    def __init__(self) -> None:
        self.repository = ReportRepository()
        self.ledger_service = LedgerService()

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

        rows, total_outstanding = self.repository.customer_report(
            db,
            search=search,
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
