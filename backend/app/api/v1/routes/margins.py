from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.price_schedule import PriceSchedule
from app.models.fuel_tank import FuelTank, TankerDelivery
from app.core.enums import FuelType

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/margins")
def get_profit_margins_analytics(db: Session = Depends(get_db)):
    # 1. Retrieve all distinct active fuel types in the system
    fuel_types = db.scalars(
        select(FuelTank.fuel_type)
        .where(FuelTank.is_active == True)
        .distinct()
    ).all()

    # If no active tanks, default to some standard fuel types so the chart doesn't crash
    if not fuel_types:
        fuel_types = [FuelType.PETROL, FuelType.DIESEL, FuelType.SPEED]

    today = date.today()
    series = []

    # Calculate for the last 30 days (from 29 days ago to today)
    for i in range(29, -1, -1):
        target_date = today - timedelta(days=i)
        check_time = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            23,
            59,
            59,
            tzinfo=timezone.utc,
        )

        day_entry = {"date": target_date.isoformat()}

        for fuel_type in fuel_types:
            # Get selling rate at target_date
            schedule = db.scalar(
                select(PriceSchedule)
                .where(
                    PriceSchedule.fuel_type == fuel_type,
                    PriceSchedule.effective_from <= check_time,
                    PriceSchedule.is_active == True,
                )
                .order_by(PriceSchedule.effective_from.desc())
                .limit(1)
            )
            selling_rate = float(schedule.rate) if schedule else None

            # Get latest procurement rate at or before target_date
            delivery = db.scalar(
                select(TankerDelivery)
                .join(FuelTank)
                .where(
                    FuelTank.fuel_type == fuel_type,
                    TankerDelivery.delivery_date <= target_date,
                    TankerDelivery.procurement_rate != None,
                    TankerDelivery.is_active == True,
                )
                .order_by(
                    TankerDelivery.delivery_date.desc(), TankerDelivery.id.desc()
                )
                .limit(1)
            )
            procurement_rate = float(delivery.procurement_rate) if delivery else None

            # Margin is selling_rate - procurement_rate
            if selling_rate is not None and procurement_rate is not None:
                day_entry[fuel_type.value] = round(
                    selling_rate - procurement_rate, 2
                )
            else:
                day_entry[fuel_type.value] = None

        series.append(day_entry)

    return series
