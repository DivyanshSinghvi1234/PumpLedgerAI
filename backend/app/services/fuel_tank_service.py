from __future__ import annotations

from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.fuel_tank import FuelTank, DipReading, TankerDelivery
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.voucher import Voucher
from app.repositories.fuel_tank_repository import FuelTankRepository, DipReadingRepository
from app.core.enums import FuelType
from app.services.audit_log_service import AuditLogService


class FuelTankService:

    def __init__(self):
        self.tank_repo = FuelTankRepository()
        self.dip_repo = DipReadingRepository()
        self.audit_service = AuditLogService()

    def create_tank(
        self,
        db: Session,
        name: str,
        fuel_type: FuelType,
        capacity_liters: float,
        current_stock_liters: float = 0.0,
        actor_id: int | None = None,
    ) -> FuelTank:
        tank = FuelTank(
            name=name,
            fuel_type=fuel_type,
            capacity_liters=capacity_liters,
            current_stock_liters=current_stock_liters,
        )
        tank = self.tank_repo.create(db, tank)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Created Fuel Tank",
            target_table="fuel_tanks",
            target_id=str(tank.id),
            actor_id=actor_id,
            new_values={
                "name": tank.name,
                "fuel_type": tank.fuel_type.value,
                "capacity_liters": str(tank.capacity_liters),
                "current_stock_liters": str(tank.current_stock_liters),
            }
        )
        return tank

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

    def create_delivery(self, db: Session, tank_uuid: str, delivery_date: date, invoice_number: str, quantity_liters: float, density: float | None = None, supplier_name: str | None = None, remarks: str | None = None) -> TankerDelivery:
        tank = self.tank_repo.get_by_uuid(db, tank_uuid)
        if not tank:
            raise ValueError(f"Fuel tank with UUID {tank_uuid} not found")
        if quantity_liters <= 0:
            raise ValueError("Delivery quantity must be greater than zero")
        if tank.current_stock_liters + quantity_liters > tank.capacity_liters:
            raise ValueError("Delivery would exceed the tank capacity")
        delivery = TankerDelivery(tank_id=tank.id, delivery_date=delivery_date, invoice_number=invoice_number, quantity_liters=quantity_liters, density=density, supplier_name=supplier_name, remarks=remarks)
        tank.current_stock_liters += quantity_liters
        self.tank_repo.update(db, tank)
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        return delivery

    def list_deliveries(self, db: Session) -> list[TankerDelivery]:
        return list(db.scalars(select(TankerDelivery).where(TankerDelivery.is_active == True).order_by(TankerDelivery.delivery_date.desc())).all())

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
        actor_id: int | None = None,
    ) -> DipReading:
        """Post a daily physical dip reading, calculate variance against vouchers, and sync current stock."""
        tank = self.tank_repo.get_by_uuid(db, tank_uuid)
        if not tank:
            raise ValueError(f"Fuel tank with UUID {tank_uuid} not found")

        r_date = reading_date or date.today()

        deliveries = float(db.scalar(select(func.sum(TankerDelivery.quantity_liters)).where(TankerDelivery.tank_id == tank.id, TankerDelivery.delivery_date == r_date, TankerDelivery.is_active == True)) or 0)
        sales_calculated = opening_dip + deliveries - closing_dip

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

        nozzle_sales = float(db.scalar(select(func.sum(NozzleReading.sales)).join(Nozzle).where(Nozzle.tank_id == tank.id, NozzleReading.reading_date == r_date)) or 0)
        unbilled = nozzle_sales - actual_sales_float
        physical_leak = sales_calculated - nozzle_sales
        variance = actual_sales_float - sales_calculated
        tolerance = round(nozzle_sales * 0.005, 3)

        # 4. Create the DipReading
        dip_reading = DipReading(
            tank_id=tank.id,
            reading_date=r_date,
            opening_dip_liters=opening_dip,
            closing_dip_liters=closing_dip,
            sales_liters_calculated=sales_calculated,
            actual_sales_from_vouchers=actual_sales_float,
            variance_liters=variance,
            deliveries_liters=deliveries,
            nozzle_sales_liters=nozzle_sales,
            unbilled_cash_variance=unbilled,
            physical_leak_variance=physical_leak,
            variance_tolerance_liters=tolerance,
        )

        # 5. Reset the tank's current virtual stock to match the actual closing physical dip
        old_stock = tank.current_stock_liters
        tank.current_stock_liters = closing_dip
        self.tank_repo.update(db, tank)

        dip_reading = self.dip_repo.create(db, dip_reading)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Posted Dip Reading",
            target_table="dip_readings",
            target_id=str(dip_reading.id),
            actor_id=actor_id,
            new_values={
                "tank_id": str(tank.id),
                "tank_name": tank.name,
                "reading_date": str(r_date),
                "opening_dip_liters": str(opening_dip),
                "closing_dip_liters": str(closing_dip),
                "sales_liters_calculated": str(sales_calculated),
                "actual_sales_from_vouchers": str(actual_sales_float),
                "variance_liters": str(variance),
                "tank_current_stock_liters": str(closing_dip),
            }
        )
        return dip_reading
