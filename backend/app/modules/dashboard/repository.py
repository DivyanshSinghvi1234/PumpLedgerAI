from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import FuelType, VerificationStatus
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.voucher import Voucher


class DashboardRepository:

    def get_summary(
        self,
        db: Session,
    ) -> dict:

        total_sales = db.scalar(
            select(
                func.coalesce(
                    func.sum(Voucher.total_amount),
                    0,
                )
            )
        )

        today_sales = db.scalar(
            select(
                func.coalesce(
                    func.sum(Voucher.total_amount),
                    0,
                )
            ).where(
                Voucher.invoice_date == date.today()
            )
        )

        total_vouchers = db.scalar(
            select(func.count(Voucher.id))
        )

        today_vouchers = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.invoice_date == date.today()
            )
        )

        total_customers = db.scalar(
            select(func.count(Customer.id))
        )

        total_vehicles = db.scalar(
            select(func.count(Vehicle.id))
        )

        pending_review = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.verification_status == VerificationStatus.PENDING
            )
        )

        verified = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.verification_status == VerificationStatus.VERIFIED
            )
        )

        petrol = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.fuel_type == FuelType.PETROL
            )
        )

        diesel = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.fuel_type == FuelType.DIESEL
            )
        )

        lubricant = db.scalar(
            select(func.count(Voucher.id)).where(
                Voucher.fuel_type == FuelType.LUBRICANT
            )
        )

        recent = list(
            db.scalars(
                select(Voucher)
                .options(joinedload(Voucher.customer))
                .order_by(Voucher.created_at.desc())
                .limit(5)
            ).all()
        )

        return {
            "summary": {
                "today_sales": today_sales,
                "total_sales": total_sales,
                "today_vouchers": today_vouchers,
                "total_vouchers": total_vouchers,
                "total_customers": total_customers,
                "total_vehicles": total_vehicles,
                "pending_review": pending_review,
                "verified": verified,
            },
            "fuel_distribution": {
                "petrol": petrol,
                "diesel": diesel,
                "lubricant": lubricant,
            },
            "recent_vouchers": recent,
        }