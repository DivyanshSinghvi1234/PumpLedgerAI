from __future__ import annotations

from datetime import date
from decimal import Decimal
from sqlalchemy import select, func, desc

from sqlalchemy.orm import Session

from app.models.fuel_tank import FuelTank, DipReading, TankerDelivery
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.voucher import Voucher
from app.repositories.fuel_tank_repository import FuelTankRepository, DipReadingRepository
from app.core.enums import FuelType, PaymentMode
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
        tally_godown_name: str | None = None,
        actor_id: int | None = None,
    ) -> FuelTank:
        tank = FuelTank(
            name=name,
            fuel_type=fuel_type,
            capacity_liters=capacity_liters,
            current_stock_liters=current_stock_liters,
            tally_godown_name=tally_godown_name,
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
                "tally_godown_name": tank.tally_godown_name,
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
        tank.current_stock_liters = tank.current_stock_liters - float(quantity)
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

    def deduct_tank_stock(self, db: Session, tank_id: int, quantity: float) -> None:
        """Deduct stock from a specific tank by ID (allowing negative values)."""
        tank = db.get(FuelTank, tank_id)
        if tank:
            tank.current_stock_liters -= quantity
            self.tank_repo.update(db, tank)

    def restore_tank_stock(self, db: Session, tank_id: int, quantity: float) -> None:
        """Restore stock to a specific tank by ID (capping at capacity)."""
        tank = db.get(FuelTank, tank_id)
        if tank:
            tank.current_stock_liters = min(
                tank.capacity_liters,
                tank.current_stock_liters + quantity
            )
            self.tank_repo.update(db, tank)

    @staticmethod
    def update_weighted_avg_cost(tank: FuelTank, added_liters: float, rate: float | None) -> None:
        """Update tank's weighted average landed cost/L before adding added_liters."""
        if not rate or rate <= 0 or added_liters <= 0:
            return
        prev_stock = max(0.0, float(tank.current_stock_liters or 0.0))
        prev_cost = float(tank.avg_cost_per_liter or rate)
        new_total = prev_stock + float(added_liters)
        if new_total > 0:
            tank.avg_cost_per_liter = round(
                ((prev_stock * prev_cost) + (float(added_liters) * float(rate))) / new_total,
                4,
            )

    def create_delivery(
        self,
        db: Session,
        tank_uuid: str,
        delivery_date: date,
        invoice_number: str,
        quantity_liters: float,
        density: float | None = None,
        supplier_name: str | None = None,
        remarks: str | None = None,
        procurement_rate: float | None = None,
        payment_mode: PaymentMode = PaymentMode.CREDIT,
        bank_account_uuid: str | None = None,
        ignore_capacity: bool = False,
        dip_before_liters: float | None = None,
        dip_after_liters: float | None = None,
    ) -> TankerDelivery:
        tank = self.tank_repo.get_by_uuid(db, tank_uuid)
        if not tank:
            raise ValueError(f"Fuel tank with UUID {tank_uuid} not found")
        if quantity_liters <= 0:
            raise ValueError("Delivery quantity must be greater than zero")
        
        # Capacity validation downgrade: check if it exceeds and raise distinct CAPACITY_WARNING
        if not ignore_capacity and tank.current_stock_liters + quantity_liters > tank.capacity_liters:
            raise ValueError("CAPACITY_WARNING: Delivery would exceed the tank capacity")

        computed_remarks = remarks or ""
        if dip_before_liters is not None and dip_after_liters is not None:
            actual_gain = round(float(dip_after_liters) - float(dip_before_liters), 2)
            diff = round(actual_gain - float(quantity_liters), 2)
            dip_note = f"[Dip Check: Before {dip_before_liters}L → After {dip_after_liters}L = {actual_gain}L gain vs {quantity_liters}L invoice ({diff:+.1f}L)]"
            computed_remarks = f"{computed_remarks} {dip_note}".strip()

        delivery = TankerDelivery(
            tank_id=tank.id,
            delivery_date=delivery_date,
            invoice_number=invoice_number,
            quantity_liters=quantity_liters,
            density=density,
            supplier_name=supplier_name,
            remarks=computed_remarks or None,
            procurement_rate=procurement_rate,
            payment_mode=payment_mode,
            pump_id=tank.pump_id,
        )

        db.add(delivery)
        db.flush()

        # Automatically log a corresponding expense record & bank debit if procurement rate is provided
        if procurement_rate and procurement_rate > 0:
            from app.models.income import Income
            from app.core.enums import IncomeKind

            expense_amt = Decimal(str(round(quantity_liters * procurement_rate, 2)))
            bank_account_id = None
            if bank_account_uuid and payment_mode in (PaymentMode.BANK, PaymentMode.UPI, PaymentMode.CARD):
                from app.services.bank_account_service import BankAccountService

                acc = BankAccountService().sync_from_entity(
                    db,
                    bank_account_uuid=bank_account_uuid,
                    amount=expense_amt,
                    transaction_type="EXPENSE",
                    transaction_date=delivery_date,
                    reference_number=f"DEL-{delivery.id}",
                    remarks=f"Tanker Delivery ({quantity_liters}L {tank.fuel_type.value}, Inv: {invoice_number or 'N/A'})",
                    pump_id=delivery.pump_id,
                )
                if acc is not None:
                    bank_account_id = acc.id

            expense = Income(
                kind=IncomeKind.EXPENSE,
                income_date=delivery_date,
                amount=expense_amt,
                category="Procurement",
                description=f"Procurement of {quantity_liters}L {tank.fuel_type} for {tank.name} (Inv: {invoice_number or 'N/A'}, Supplier: {supplier_name or 'N/A'})",
                payment_mode=payment_mode,
                bank_account_id=bank_account_id,
                pump_id=delivery.pump_id,
            )
            db.add(expense)

        self.update_weighted_avg_cost(tank, quantity_liters, procurement_rate)
        tank.current_stock_liters += quantity_liters
        self.tank_repo.update(db, tank)
        db.commit()
        db.refresh(delivery)
        return delivery

    def list_deliveries(self, db: Session) -> list[TankerDelivery]:
        return list(db.scalars(select(TankerDelivery).where(TankerDelivery.is_active == True).order_by(TankerDelivery.delivery_date.desc())).all())

    def delete_delivery(self, db: Session, delivery_uuid: str, actor_id: int | None = None) -> None:
        """Reverse a TankerDelivery: restore tank stock, reverse bank debit, and soft-delete procurement expense."""
        delivery = db.scalar(
            select(TankerDelivery).where(
                TankerDelivery.uuid == delivery_uuid,
                TankerDelivery.is_active.is_(True),
            )
        )
        if delivery is None:
            raise ValueError(f"Tanker delivery '{delivery_uuid}' not found.")

        tank = db.get(FuelTank, delivery.tank_id)
        if tank is not None:
            tank.current_stock_liters = max(0.0, float(tank.current_stock_liters) - float(delivery.quantity_liters))
            db.add(tank)

        from app.services.bank_account_service import BankAccountService
        BankAccountService().reverse_by_reference(db, f"DEL-{delivery.id}")

        if delivery.procurement_rate and delivery.procurement_rate > 0:
            from app.models.income import Income
            from app.core.enums import IncomeKind

            exp_amt = Decimal(str(round(delivery.quantity_liters * delivery.procurement_rate, 2)))
            exp = db.scalar(
                select(Income)
                .where(
                    Income.is_active.is_(True),
                    Income.kind == IncomeKind.EXPENSE,
                    Income.category == "Procurement",
                    Income.income_date == delivery.delivery_date,
                    Income.amount == exp_amt,
                )
                .order_by(Income.id.desc())
                .limit(1)
            )
            if exp is not None:
                exp.is_active = False
                db.add(exp)

        delivery.is_active = False
        db.add(delivery)
        db.commit()

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

    def update_tank(
        self,
        db: Session,
        uuid: str,
        name: str | None = None,
        fuel_type: FuelType | None = None,
        capacity_liters: float | None = None,
        current_stock_liters: float | None = None,
        tally_godown_name: str | None = "-NO_CHANGE-",
        ignore_capacity: bool = False,
        actor_id: int | None = None,
    ) -> FuelTank:
        tank = self.tank_repo.get_by_uuid(db, uuid)
        if not tank:
            raise ValueError(f"Fuel tank with UUID {uuid} not found")

        # Capacity validation downward: check if it's below current stock
        cap = capacity_liters if capacity_liters is not None else tank.capacity_liters
        stock = current_stock_liters if current_stock_liters is not None else tank.current_stock_liters
        if not ignore_capacity and cap < stock:
            raise ValueError("CAPACITY_WARNING: New capacity is below the current stock level")

        if name is not None:
            tank.name = name
        if fuel_type is not None:
            tank.fuel_type = fuel_type
        if capacity_liters is not None:
            tank.capacity_liters = capacity_liters
        if current_stock_liters is not None:
            tank.current_stock_liters = current_stock_liters
        if tally_godown_name != "-NO_CHANGE-":
            tank.tally_godown_name = tally_godown_name

        self.tank_repo.update(db, tank)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Updated Fuel Tank",
            target_table="fuel_tanks",
            target_id=str(tank.id),
            actor_id=actor_id,
            new_values={
                "name": tank.name,
                "fuel_type": tank.fuel_type.value,
                "capacity_liters": str(tank.capacity_liters),
                "current_stock_liters": str(tank.current_stock_liters),
                "tally_godown_name": tank.tally_godown_name,
            }
        )
        return tank

    def delete_tank(self, db: Session, uuid: str, actor_id: int | None = None) -> None:
        tank = self.tank_repo.get_by_uuid(db, uuid)
        if not tank:
            raise ValueError(f"Fuel tank with UUID {uuid} not found")

        # Soft-delete the tank
        tank.is_active = False
        self.tank_repo.update(db, tank)

        # Auto-null referencing nozzles
        nozzles = db.scalars(select(Nozzle).where(Nozzle.tank_id == tank.id)).all()
        for nozzle in nozzles:
            nozzle.tank_id = None
            db.add(nozzle)
        db.commit()

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Fuel Tank",
            target_table="fuel_tanks",
            target_id=str(tank.id),
            actor_id=actor_id,
            old_values={
                "name": tank.name,
                "fuel_type": tank.fuel_type.value,
            }
        )

    def create_tank_transfer(
        self,
        db: Session,
        source_tank_uuid: str,
        destination_tank_uuid: str,
        transfer_date: date,
        quantity_liters: float,
        reason: str,
        remarks: str | None = None,
        ignore_capacity: bool = False,
        actor_id: int | None = None,
    ) -> TankTransfer:
        from app.models.fuel_tank import TankTransfer
        source_tank = self.tank_repo.get_by_uuid(db, source_tank_uuid)
        if not source_tank:
            raise ValueError("Source fuel tank not found")

        destination_tank = self.tank_repo.get_by_uuid(db, destination_tank_uuid)
        if not destination_tank:
            raise ValueError("Destination fuel tank not found")

        if source_tank.id == destination_tank.id:
            raise ValueError("Source and destination tank cannot be the same")

        if quantity_liters <= 0:
            raise ValueError("Transfer quantity must be greater than zero")

        if source_tank.current_stock_liters < quantity_liters:
            raise ValueError(
                f"Insufficient stock in '{source_tank.name}': current stock is "
                f"{source_tank.current_stock_liters:.1f} L, but transfer requires {quantity_liters:.1f} L."
            )

        if not ignore_capacity and (destination_tank.current_stock_liters + quantity_liters > destination_tank.capacity_liters):
            raise ValueError("CAPACITY_WARNING: Transfer would exceed destination tank capacity")

        # Execute stock movement
        source_tank.current_stock_liters -= quantity_liters
        destination_tank.current_stock_liters += quantity_liters

        self.tank_repo.update(db, source_tank)
        self.tank_repo.update(db, destination_tank)

        transfer = TankTransfer(
            transfer_date=transfer_date,
            source_tank_id=source_tank.id,
            destination_tank_id=destination_tank.id,
            quantity_liters=quantity_liters,
            reason=reason.strip(),
            remarks=remarks.strip() if remarks else None,
            pump_id=source_tank.pump_id,
        )
        db.add(transfer)
        db.flush()

        self.audit_service.log_action(
            db,
            action="Recorded Inter-Tank Transfer",
            target_table="tank_transfers",
            target_id=str(transfer.id),
            actor_id=actor_id,
            new_values={
                "source_tank": source_tank.name,
                "destination_tank": destination_tank.name,
                "quantity_liters": str(quantity_liters),
                "reason": reason,
            }
        )
        return transfer

    def list_tank_transfers(self, db: Session) -> list[dict]:
        from app.models.fuel_tank import TankTransfer
        transfers = db.scalars(select(TankTransfer).order_by(desc(TankTransfer.transfer_date), desc(TankTransfer.created_at))).all()
        result = []
        for t in transfers:
            src = db.get(FuelTank, t.source_tank_id)
            dst = db.get(FuelTank, t.destination_tank_id)
            result.append({
                "id": t.id,
                "uuid": t.uuid,
                "transfer_date": t.transfer_date,
                "source_tank_id": t.source_tank_id,
                "destination_tank_id": t.destination_tank_id,
                "source_tank_name": src.name if src else "Unknown",
                "destination_tank_name": dst.name if dst else "Unknown",
                "quantity_liters": t.quantity_liters,
                "reason": t.reason,
                "remarks": t.remarks,
                "created_at": t.created_at,
            })
        return result

    def delete_tank_transfer(self, db: Session, transfer_uuid: str, actor_id: int | None = None) -> None:
        from app.models.fuel_tank import TankTransfer
        transfer = db.scalar(select(TankTransfer).where(TankTransfer.uuid == transfer_uuid))
        if not transfer:
            raise ValueError("Tank transfer record not found")

        source_tank = db.get(FuelTank, transfer.source_tank_id)
        destination_tank = db.get(FuelTank, transfer.destination_tank_id)

        # Revert stock movements
        if source_tank:
            source_tank.current_stock_liters += transfer.quantity_liters
            self.tank_repo.update(db, source_tank)
        if destination_tank:
            destination_tank.current_stock_liters = max(0.0, destination_tank.current_stock_liters - transfer.quantity_liters)
            self.tank_repo.update(db, destination_tank)

        db.delete(transfer)
        db.commit()

        self.audit_service.log_action(
            db,
            action="Reverted Inter-Tank Transfer",
            target_table="tank_transfers",
            target_id=str(transfer.id),
            actor_id=actor_id,
        )

    def get_margin_analytics(self, db: Session, pump_id: int) -> dict:
        """Tank-Wise Profit & Variance, Procurement Cost-Per-Liter Trend, and Low Bank Balance Alert for Indents."""
        from datetime import datetime, timezone
        from sqlalchemy import func
        from app.models.bank_account import BankAccount
        from app.models.nozzle import Nozzle
        from app.models.nozzle_reading import NozzleReading
        from app.models.purchase_indent import IndentStatus, PurchaseIndent
        from app.models.stock_variance import StockVariance
        from app.services.price_schedule_service import PriceScheduleService

        price_service = PriceScheduleService()
        today = date.today()
        now_dt = datetime.now(timezone.utc)

        tanks = list(
            db.scalars(
                select(FuelTank).where(FuelTank.pump_id == pump_id, FuelTank.is_active.is_(True))
            ).all()
        )
        tank_cards: list[dict] = []
        for t in tanks:
            selling_rate = float(price_service.get_active_rate(db, t.fuel_type, now_dt) or 0.0)
            avg_cost = float(t.avg_cost_per_liter or 0.0)
            margin_per_l = round(selling_rate - avg_cost, 2) if avg_cost > 0 and selling_rate > 0 else 0.0

            # Today's nozzle sales for nozzles linked to this tank (or matching fuel_type)
            nozzle_ids = list(
                db.scalars(
                    select(Nozzle.id).where(
                        Nozzle.pump_id == pump_id,
                        Nozzle.is_active.is_(True),
                        (Nozzle.tank_id == t.id) | ((Nozzle.tank_id.is_(None)) & (Nozzle.fuel_type == t.fuel_type)),
                    )
                ).all()
            )
            net_sales_l = 0.0
            if nozzle_ids:
                net_sales_l = float(
                    db.scalar(
                        select(func.coalesce(func.sum(NozzleReading.sales), 0.0)).where(
                            NozzleReading.nozzle_id.in_(nozzle_ids),
                            NozzleReading.reading_date == today,
                        )
                    )
                    or 0.0
                )
            sv = db.scalar(
                select(StockVariance).where(
                    StockVariance.tank_id == t.id,
                    StockVariance.variance_date == today,
                )
            )
            dip_var_l = float(sv.variance_liters or 0.0) if sv else 0.0
            dip_loss_rs = abs(min(0.0, dip_var_l)) * (avg_cost or selling_rate)
            gross_profit = round((margin_per_l * net_sales_l) - dip_loss_rs, 2)
            fill_pct = round((float(t.current_stock_liters) / float(t.capacity_liters)) * 100, 1) if t.capacity_liters else 0.0

            tank_cards.append(
                {
                    "tank_uuid": str(t.uuid),
                    "tank_name": t.name,
                    "fuel_type": t.fuel_type.value if hasattr(t.fuel_type, "value") else str(t.fuel_type),
                    "current_stock_liters": round(float(t.current_stock_liters), 1),
                    "capacity_liters": round(float(t.capacity_liters), 1),
                    "fill_percent": fill_pct,
                    "avg_cost_per_liter": round(avg_cost, 2),
                    "selling_rate": round(selling_rate, 2),
                    "margin_per_liter": margin_per_l,
                    "today_net_sales_liters": round(net_sales_l, 2),
                    "today_dip_variance_liters": round(dip_var_l, 2),
                    "today_gross_profit": gross_profit,
                }
            )

        # Procurement Cost-Per-Liter Trend (last 20 deliveries with rate)
        deliveries = list(
            db.scalars(
                select(TankerDelivery)
                .where(
                    TankerDelivery.pump_id == pump_id,
                    TankerDelivery.is_active.is_(True),
                    TankerDelivery.procurement_rate.isnot(None),
                )
                .order_by(TankerDelivery.delivery_date.asc(), TankerDelivery.id.asc())
                .limit(20)
            ).all()
        )
        tank_map = {t.id: t for t in tanks}
        trend: list[dict] = []
        for d in deliveries:
            tk = tank_map.get(d.tank_id)
            ft = tk.fuel_type if tk else FuelType.DIESEL
            sell_r = float(price_service.get_active_rate(db, ft, now_dt) or 0.0)
            trend.append(
                {
                    "date": d.delivery_date.isoformat(),
                    "fuel_type": ft.value if hasattr(ft, "value") else str(ft),
                    "procurement_rate": float(d.procurement_rate or 0.0),
                    "selling_rate": sell_r,
                    "quantity_liters": float(d.quantity_liters),
                }
            )

        # Low Bank Balance Alert for Upcoming OMC Indents
        pending_indents = list(
            db.scalars(
                select(PurchaseIndent).where(
                    PurchaseIndent.pump_id == pump_id,
                    PurchaseIndent.is_active.is_(True),
                    PurchaseIndent.status.in_([IndentStatus.PENDING, IndentStatus.ORDERED]),
                )
            ).all()
        )
        pending_cost = sum(float(i.estimated_cost or 0.0) for i in pending_indents)
        total_bank_bal = float(
            db.scalar(
                select(func.coalesce(func.sum(BankAccount.current_balance), 0.0)).where(
                    BankAccount.pump_id == pump_id,
                    BankAccount.is_active.is_(True),
                )
            )
            or 0.0
        )
        shortfall = round(max(0.0, pending_cost - total_bank_bal), 2)

        return {
            "tanks": tank_cards,
            "procurement_trend": trend,
            "indent_bank_alert": {
                "pending_indent_count": len(pending_indents),
                "pending_indent_cost": round(pending_cost, 2),
                "total_bank_balance": round(total_bank_bal, 2),
                "is_short": shortfall > 0,
                "shortfall": shortfall,
            },
        }

    def omc_invoice_ocr_autopilot(
        self,
        db: Session,
        *,
        pump_id: int,
        tank_uuid: str,
        invoice_number: str,
        delivery_date: date,
        quantity_liters: float,
        total_amount: float,
        density: float | None = None,
        supplier_name: str | None = None,
        bank_account_uuid: str | None = None,
        payment_mode: PaymentMode = PaymentMode.BANK,
        dip_before_liters: float | None = None,
        dip_after_liters: float | None = None,
        actor_id: int | None = None,
    ) -> dict:
        """OMC Invoice OCR -> Full Tanker Pipeline Auto-Pilot:
        1. Auto-matches open OMC PurchaseIndent for this fuel type
        2. Creates TankerDelivery + updates Tank Stock & avg_cost_per_liter
        3. Debits selected BankAccount (idempotently via DEL-{id})
        4. Flags any short-delivery variance vs indent or dip check."""
        from app.models.purchase_indent import IndentStatus, PurchaseIndent

        tank = self.tank_repo.get_by_uuid(db, tank_uuid)
        if not tank:
            raise ValueError(f"Fuel tank {tank_uuid} not found")

        proc_rate = round(total_amount / quantity_liters, 4) if quantity_liters > 0 else 0.0

        # Auto-match open PurchaseIndent
        matched_indent = db.scalar(
            select(PurchaseIndent)
            .where(
                PurchaseIndent.pump_id == pump_id,
                PurchaseIndent.fuel_type == tank.fuel_type,
                PurchaseIndent.is_active.is_(True),
                PurchaseIndent.status.in_([IndentStatus.ORDERED, IndentStatus.PENDING]),
            )
            .order_by(PurchaseIndent.indent_date.asc(), PurchaseIndent.id.asc())
            .limit(1)
        )
        short_delivery_liters = 0.0
        indent_number = None
        if matched_indent is not None:
            indent_number = matched_indent.indent_number
            short_delivery_liters = round(float(matched_indent.quantity_liters) - float(quantity_liters), 2)
            matched_indent.status = IndentStatus.DELIVERED

        remarks = f"OMC Auto-Pilot (Indent: {indent_number})" if indent_number else "OMC Auto-Pilot"
        if abs(short_delivery_liters) > 0:
            remarks += f" | Indent Variance: {short_delivery_liters:+.1f}L"

        delivery = self.create_delivery(
            db,
            tank_uuid=tank_uuid,
            delivery_date=delivery_date,
            invoice_number=invoice_number,
            quantity_liters=quantity_liters,
            density=density,
            supplier_name=supplier_name,
            remarks=remarks,
            procurement_rate=proc_rate,
            payment_mode=payment_mode,
            bank_account_uuid=bank_account_uuid,
            ignore_capacity=True,
            dip_before_liters=dip_before_liters,
            dip_after_liters=dip_after_liters,
        )
        return {
            "delivery_uuid": str(delivery.uuid),
            "invoice_number": delivery.invoice_number,
            "quantity_liters": delivery.quantity_liters,
            "procurement_rate": proc_rate,
            "matched_indent_number": indent_number,
            "short_delivery_liters": short_delivery_liters,
            "new_tank_stock": float(tank.current_stock_liters),
            "new_avg_cost_per_liter": float(tank.avg_cost_per_liter or proc_rate),
        }

