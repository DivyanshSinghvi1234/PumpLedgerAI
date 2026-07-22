from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import FuelType, PaymentMode, PaymentStatus
from app.models.customer import Customer
from app.models.voucher import Voucher


class ReportRepository:

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
    ) -> tuple[list[Voucher], dict]:

        query = select(Voucher)

        if from_date:
            query = query.where(Voucher.invoice_date >= from_date)

        if to_date:
            query = query.where(Voucher.invoice_date <= to_date)

        if fuel_type:
            query = query.where(Voucher.fuel_type == fuel_type)

        if payment_mode:
            query = query.where(Voucher.payment_mode == payment_mode)

        if verification_status:
            query = query.where(
                Voucher.verification_status == verification_status
            )

        rows = list(
            db.scalars(
                query.order_by(Voucher.invoice_date.desc())
            ).all()
        )

        # Aggregate totals over the same filtered set.
        totals_query = select(
            func.coalesce(func.sum(Voucher.total_amount), 0),
            func.coalesce(func.sum(Voucher.quantity_liters), 0),
            func.count(Voucher.id),
        )

        if from_date:
            totals_query = totals_query.where(
                Voucher.invoice_date >= from_date
            )
        if to_date:
            totals_query = totals_query.where(
                Voucher.invoice_date <= to_date
            )
        if fuel_type:
            totals_query = totals_query.where(
                Voucher.fuel_type == fuel_type
            )
        if payment_mode:
            totals_query = totals_query.where(
                Voucher.payment_mode == payment_mode
            )
        if verification_status:
            totals_query = totals_query.where(
                Voucher.verification_status == verification_status
            )

        total_amount, total_quantity, count = db.execute(
            totals_query
        ).one()

        return rows, {
            "total_amount": Decimal(str(total_amount)),
            "total_quantity": Decimal(str(total_quantity)),
            "count": count,
        }

    # -----------------------------------
    # Customer Report
    # -----------------------------------

    def customer_report(
        self,
        db: Session,
        *,
        search: str | None = None,
    ) -> tuple[list[Customer], Decimal]:

        query = select(Customer).where(
            Customer.is_active.is_(True)
        )

        if search:
            pattern = f"%{search}%"
            query = query.where(
                Customer.name.ilike(pattern)
            )

        rows = list(
            db.scalars(
                query.order_by(Customer.name)
            ).all()
        )

        total_outstanding = db.scalar(
            select(
                func.coalesce(
                    func.sum(Customer.outstanding_balance),
                    0,
                )
            ).where(Customer.is_active.is_(True))
        )

        return rows, Decimal(str(total_outstanding))

    # -----------------------------------
    # Daily Sales (any date)
    # -----------------------------------

    def daily_sales(
        self,
        db: Session,
        *,
        on_date: date,
    ) -> dict:

        def _sum(*conditions) -> Decimal:
            stmt = select(
                func.coalesce(func.sum(Voucher.total_amount), 0)
            ).where(Voucher.invoice_date == on_date)
            for cond in conditions:
                stmt = stmt.where(cond)
            return Decimal(str(db.scalar(stmt)))

        total_sales = _sum()

        total_vouchers = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.invoice_date == on_date
            )
        ) or 0

        petrol_sales = _sum(Voucher.fuel_type == FuelType.PETROL)
        diesel_sales = _sum(Voucher.fuel_type == FuelType.DIESEL)

        cash_sales = _sum(Voucher.payment_mode == PaymentMode.CASH)
        upi_sales = _sum(Voucher.payment_mode == PaymentMode.UPI)
        credit_sales = _sum(Voucher.payment_mode == PaymentMode.CREDIT)

        average_invoice = (
            (total_sales / total_vouchers)
            if total_vouchers
            else Decimal("0.00")
        ).quantize(Decimal("0.01"))

        return {
            "report_date": on_date,
            "total_sales": total_sales,
            "total_vouchers": total_vouchers,
            "petrol_sales": petrol_sales,
            "diesel_sales": diesel_sales,
            "cash_sales": cash_sales,
            "upi_sales": upi_sales,
            "credit_sales": credit_sales,
            "average_invoice": average_invoice,
        }

    # -----------------------------------
    # Debtor Aging
    # -----------------------------------

    def open_credit_vouchers(
        self,
        db: Session,
    ) -> list[tuple[Voucher, Customer]]:
        """Open (UNPAID/PARTIAL) vouchers linked to a customer, with the
        customer joined. Walk-in (customer-less) vouchers are excluded — there
        is no debtor to age. Ordered oldest-first for readable output."""

        query = (
            select(Voucher, Customer)
            .join(Customer, Voucher.customer_id == Customer.id)
            .where(
                Voucher.customer_id.isnot(None),
                Voucher.payment_status.in_(
                    [PaymentStatus.UNPAID, PaymentStatus.PARTIAL]
                ),
                Customer.is_active.is_(True),
            )
            .order_by(Voucher.invoice_date.asc())
        )

        return list(db.execute(query).all())
