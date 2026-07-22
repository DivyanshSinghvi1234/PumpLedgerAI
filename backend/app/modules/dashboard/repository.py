from __future__ import annotations

from datetime import date

from sqlalchemy import func, select, case
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

        # Single conditional aggregation query to load all voucher stats
        stmt = select(
            func.coalesce(func.sum(Voucher.total_amount), 0).label("total_sales"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.invoice_date == date.today(), Voucher.total_amount),
                        else_=0
                    )
                ),
                0
            ).label("today_sales"),
            func.count(Voucher.id).label("total_vouchers"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.invoice_date == date.today(), 1),
                        else_=0
                    )
                ),
                0
            ).label("today_vouchers"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.verification_status == VerificationStatus.PENDING, 1),
                        else_=0
                    )
                ),
                0
            ).label("pending_review"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.verification_status == VerificationStatus.VERIFIED, 1),
                        else_=0
                    )
                ),
                0
            ).label("verified"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.fuel_type == FuelType.PETROL, 1),
                        else_=0
                    )
                ),
                0
            ).label("petrol"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.fuel_type == FuelType.DIESEL, 1),
                        else_=0
                    )
                ),
                0
            ).label("diesel"),
            func.coalesce(
                func.sum(
                    case(
                        (Voucher.fuel_type == FuelType.LUBRICANT, 1),
                        else_=0
                    )
                ),
                0
            ).label("lubricant")
        )
        res = db.execute(stmt).mappings().one()

        # Counts from independent tables
        total_customers = db.scalar(
            select(func.count(Customer.id))
        )

        total_vehicles = db.scalar(
            select(func.count(Vehicle.id))
        )

        # Recent vouchers (maintains original behaviour)
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
                "today_sales": res["today_sales"],
                "total_sales": res["total_sales"],
                "today_vouchers": res["today_vouchers"],
                "total_vouchers": res["total_vouchers"],
                "total_customers": total_customers or 0,
                "total_vehicles": total_vehicles or 0,
                "pending_review": res["pending_review"],
                "verified": res["verified"],
            },
            "fuel_distribution": {
                "petrol": res["petrol"],
                "diesel": res["diesel"],
                "lubricant": res["lubricant"],
            },
            "recent_vouchers": recent,
        }