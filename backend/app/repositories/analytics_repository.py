from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import (
    FuelType,
    PaymentMode,
)
from app.models.voucher import Voucher


class AnalyticsRepository:

    def dashboard_summary(
        self,
        db: Session,
    ) -> dict:

        today = date.today()

        vouchers = db.scalars(
            select(Voucher).where(
                Voucher.invoice_date == today,
            )
        ).all()

        total_sales = Decimal("0.00")
        petrol_sales = Decimal("0.00")
        diesel_sales = Decimal("0.00")
        cash_sales = Decimal("0.00")
        upi_sales = Decimal("0.00")
        credit_sales = Decimal("0.00")

        for voucher in vouchers:

            total_sales += voucher.total_amount

            if voucher.fuel_type == FuelType.PETROL:
                petrol_sales += voucher.total_amount

            elif voucher.fuel_type == FuelType.DIESEL:
                diesel_sales += voucher.total_amount

            if voucher.payment_mode == PaymentMode.CASH:
                cash_sales += voucher.total_amount

            elif voucher.payment_mode == PaymentMode.UPI:
                upi_sales += voucher.total_amount

            elif voucher.payment_mode == PaymentMode.CREDIT:
                credit_sales += voucher.total_amount

        count = len(vouchers)

        average = (
            total_sales / count
            if count
            else Decimal("0.00")
        )

        return {
            "today_sales": total_sales,
            "today_vouchers": count,
            "petrol_sales": petrol_sales,
            "diesel_sales": diesel_sales,
            "cash_sales": cash_sales,
            "upi_sales": upi_sales,
            "credit_sales": credit_sales,
            "average_invoice": average,
        }