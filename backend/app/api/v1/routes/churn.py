from __future__ import annotations

from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies import get_db
from app.models.customer import Customer
from app.models.voucher import Voucher

router = APIRouter(prefix="/analytics", tags=["Customer Analytics"])


class CustomerRFMDetail(BaseModel):
    customer_uuid: str
    customer_name: str
    customer_code: str | None
    mobile: str | None
    recency_days: int
    frequency: int
    monetary_value: float
    segment: str
    dormancy_date: str | None


class ChurnAnalyticsResponse(BaseModel):
    segments: dict[str, int]
    customers: list[CustomerRFMDetail]


@router.get("/churn", response_model=ChurnAnalyticsResponse)
def get_churn_and_rfm_analytics(db: Session = Depends(get_db)):
    # 1. Retrieve all active customers (scoped to current pump automatically)
    customers = db.scalars(
        select(Customer)
        .where(Customer.is_active == True)
        .order_by(Customer.name.asc())
    ).all()

    today = date.today()

    segment_counts = {
        "Champions": 0,
        "Loyal": 0,
        "At Risk": 0,
        "Hibernating": 0,
    }

    customer_details = []

    for customer in customers:
        # Get active vouchers for this customer
        vouchers = db.scalars(
            select(Voucher)
            .where(Voucher.customer_id == customer.id, Voucher.is_active == True)
        ).all()

        frequency = len(vouchers)
        monetary_value = float(sum(v.total_amount for v in vouchers))

        if frequency > 0:
            latest_voucher_date = max(v.invoice_date for v in vouchers)
            recency_days = (today - latest_voucher_date).days
            dormancy_date = latest_voucher_date.isoformat()
        else:
            recency_days = 999
            dormancy_date = None

        # Segment assignment
        if frequency == 0:
            segment = "Hibernating"
        elif recency_days <= 15 and frequency >= 5:
            segment = "Champions"
        elif recency_days <= 30 and frequency >= 2:
            segment = "Loyal"
        elif recency_days > 30 and recency_days <= 90:
            segment = "At Risk"
        else:
            segment = "Hibernating"

        # Update summary counts
        segment_counts[segment] += 1

        customer_details.append(
            CustomerRFMDetail(
                customer_uuid=customer.uuid,
                customer_name=customer.name,
                customer_code=customer.customer_code,
                mobile=customer.mobile,
                recency_days=recency_days,
                frequency=frequency,
                monetary_value=round(monetary_value, 2),
                segment=segment,
                dormancy_date=dormancy_date,
            )
        )

    # Sort customers so At Risk / Hibernating are highlighted, or just sort by recency descending
    customer_details.sort(key=lambda c: c.recency_days, reverse=True)

    return ChurnAnalyticsResponse(
        segments=segment_counts,
        customers=customer_details,
    )
