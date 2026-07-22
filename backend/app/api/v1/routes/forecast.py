from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies import get_db
from app.models.fuel_tank import FuelTank
from app.models.voucher import Voucher
from app.core.enums import FuelType

router = APIRouter(prefix="/fuel-tanks", tags=["Fuel Tanks Forecast"])


class FuelTankForecastResponse(BaseModel):
    tank_id: int
    tank_uuid: str
    tank_name: str
    fuel_type: FuelType
    current_stock_liters: float
    capacity_liters: float
    avg_daily_sales: float
    days_until_empty: float | None


@router.get("/forecast", response_model=list[FuelTankForecastResponse])
def get_fuel_tank_forecast(db: Session = Depends(get_db)):
    # 1. Retrieve all active fuel tanks
    tanks = db.scalars(
        select(FuelTank)
        .where(FuelTank.is_active == True)
        .order_by(FuelTank.name.asc())
    ).all()

    today = date.today()
    start_date = today - timedelta(days=7)

    # Cache active tank count per fuel type to split demand across multiple active tanks
    active_tank_counts = {}
    for tank in tanks:
        active_tank_counts[tank.fuel_type] = active_tank_counts.get(tank.fuel_type, 0) + 1

    forecasts = []
    for tank in tanks:
        # Sum of active voucher sales for this fuel type in the past 7 days
        sales_sum = db.scalar(
            select(func.sum(Voucher.quantity_liters))
            .where(
                Voucher.fuel_type == tank.fuel_type,
                Voucher.invoice_date >= start_date,
                Voucher.invoice_date <= today,
                Voucher.is_active == True
            )
        ) or Decimal("0.0")

        # Demand division across all active tanks for this fuel type
        num_tanks = active_tank_counts.get(tank.fuel_type, 1)
        total_daily_sales = float(sales_sum) / 7.0
        avg_daily_sales = total_daily_sales / num_tanks

        current_stock = tank.current_stock_liters
        days_until_empty = None
        if avg_daily_sales > 0:
            if current_stock < 0:
                days_until_empty = 0.0
            else:
                days_until_empty = round(current_stock / avg_daily_sales, 1)

        forecasts.append(
            FuelTankForecastResponse(
                tank_id=tank.id,
                tank_uuid=tank.uuid,
                tank_name=tank.name,
                fuel_type=tank.fuel_type,
                current_stock_liters=current_stock,
                capacity_liters=tank.capacity_liters,
                avg_daily_sales=round(avg_daily_sales, 1),
                days_until_empty=days_until_empty,
            )
        )

    return forecasts
