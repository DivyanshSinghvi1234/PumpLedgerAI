from __future__ import annotations

from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.fuel_tank import FuelTank, DipReading
from app.models.voucher import Voucher
from app.repositories.fuel_tank_repository import FuelTankRepository, DipReadingRepository
from app.core.enums import FuelType


class FuelTankService:

    def __init__(self):
        self.tank_repo = FuelTankRepository()
        self.dip_repo = DipReadingRepository()

    def create_tank(
        self,
        db: Session,
        name: str,
        fuel_type: FuelType,
        capacity_liters: float,
        current_stock_liters: float = 0.0,
    ) -> FuelTank:
        tank = FuelTank(
            name=name,
            fuel_type=fuel_type,
            capacity_liters=capacity_liters,
            current_stock_liters=current_stock_liters,
        )
        return self.tank_repo.create(db, tank)

    def deduct_stock(
        self,
        db: Session,
        fuel_type: FuelType,
        quantity: Decimal | float,
    ) -> None:
        """Deduct stock from the first active tank matching the fuel type."""
        tanks = self.tank_repo.get_by_fuel_type(db, fuel_type)
        if not tanks:
            return  # No tank configured for this fuel type yet

        tank = tanks[0]
        tank.current_stock_liters = max(0.0, tank.current_stock_liters - float(quantity))
        self.tank_repo.update(db, tank)

    def restore_stock(
        self,
        db: Session,
        fuel_type: FuelType,
        quantity: Decimal | float,
    ) -> None:
        """Add stock back to the first active tank matching the fuel type."""
        tanks = self.tank_repo.get_by_fuel_type(db, fuel_type)
        if not tanks:
            return

        tank = tanks[0]
        tank.current_stock_liters = min(
            tank.capacity_liters,
            tank.current_stock_liters + float(quantity)
        )
        self.tank_repo.update(db, tank)

    def update_stock(
        self,
        db: Session,
        old_fuel_type: FuelType,
        old_quantity: Decimal | float,
        new_fuel_type: FuelType,
        new_quantity: Decimal | float,
    ) -> None:
        """Adjust stock when a voucher is updated."""
        # Restore the old quantity
        self.restore_stock(db, old_fuel_type, old_quantity)
        # Deduct the new quantity
        self.deduct_stock(db, new_fuel_type, new_quantity)

    def post_dip_reading(
        self,
        db: Session,
        tank_uuid: str,
        opening_dip: float,
        closing_dip: float,
        reading_date: date | None = None,
    ) -> DipReading:
        """Post a daily physical dip reading, calculate variance against vouchers, and sync current stock."""
        tank = self.tank_repo.get_by_uuid(db, tank_uuid)
        if not tank:
            raise ValueError(f"Fuel tank with UUID {tank_uuid} not found")

        r_date = reading_date or date.today()

        # 1. Calculated sales = opening - closing (assuming no receipts for simplicity)
        sales_calculated = max(0.0, opening_dip - closing_dip)

        # 2. Get actual sales from vouchers of this fuel type on this date
        # Query sum of quantity_liters of active vouchers
        actual_sales = db.scalar(
            select(func.sum(Voucher.quantity_liters))
            .where(
                Voucher.fuel_type == tank.fuel_type,
                Voucher.invoice_date == r_date,
                Voucher.is_active == True
            )
        ) or Decimal("0.0")

        actual_sales_float = float(actual_sales)

        # 3. Variance = actual sales from vouchers - calculated sales from dips
        variance = actual_sales_float - sales_calculated

        # 4. Create the DipReading
        dip_reading = DipReading(
            tank_id=tank.id,
            reading_date=r_date,
            opening_dip_liters=opening_dip,
            closing_dip_liters=closing_dip,
            sales_liters_calculated=sales_calculated,
            actual_sales_from_vouchers=actual_sales_float,
            variance_liters=variance,
        )

        # 5. Reset the tank's current virtual stock to match the actual closing physical dip
        tank.current_stock_liters = closing_dip
        self.tank_repo.update(db, tank)

        return self.dip_repo.create(db, dip_reading)
