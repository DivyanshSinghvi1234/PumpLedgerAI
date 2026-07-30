from __future__ import annotations

import random
from datetime import date, datetime
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.purchase_indent import PurchaseIndent, OMCCompany, IndentStatus
from app.models.fuel_tank import FuelTank
from app.core.enums import FuelType, PaymentMode
from app.services.fuel_tank_service import FuelTankService
from app.services.audit_log_service import AuditLogService


class PurchaseIndentService:

    def __init__(self):
        self.audit_service = AuditLogService()
        self.tank_service = FuelTankService()

    def generate_indent_number(self, db: Session) -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        rand_str = f"{random.randint(1000, 9999)}"
        return f"IND-{date_str}-{rand_str}"

    def create_indent(
        self,
        db: Session,
        omc_company: OMCCompany,
        terminal_name: str,
        fuel_type: FuelType,
        ordered_liters: float,
        expected_delivery_date: date,
        procurement_cost_per_liter: float | None = None,
        remarks: str | None = None,
        pump_id: int | None = None,
        actor_id: int | None = None,
    ) -> PurchaseIndent:
        if ordered_liters <= 0:
            raise ValueError("Ordered volume must be greater than zero.")

        if not pump_id:
            from app.models.pump import Pump
            p = db.scalars(select(Pump).where(Pump.is_active.is_(True))).first()
            if p:
                pump_id = p.id

        indent_num = self.generate_indent_number(db)
        indent = PurchaseIndent(
            indent_number=indent_num,
            omc_company=omc_company,
            terminal_name=terminal_name.strip(),
            fuel_type=fuel_type,
            ordered_liters=ordered_liters,
            expected_delivery_date=expected_delivery_date,
            procurement_cost_per_liter=procurement_cost_per_liter,
            remarks=remarks.strip() if remarks else None,
            status=IndentStatus.INDENTED,
            pump_id=pump_id,
        )
        db.add(indent)
        db.flush()


        self.audit_service.log_action(
            db,
            action="Created OMC Purchase Indent",
            target_table="purchase_indents",
            target_id=str(indent.id),
            actor_id=actor_id,
            new_values={
                "indent_number": indent_num,
                "omc_company": omc_company.value,
                "fuel_type": fuel_type.value,
                "ordered_liters": str(ordered_liters),
            }
        )
        return indent

    def list_indents(self, db: Session, status: IndentStatus | None = None) -> list[dict]:
        stmt = select(PurchaseIndent).where(PurchaseIndent.is_active.is_(True))
        if status:
            stmt = stmt.where(PurchaseIndent.status == status)
        stmt = stmt.order_by(desc(PurchaseIndent.expected_delivery_date), desc(PurchaseIndent.created_at))

        indents = db.scalars(stmt).all()
        results = []
        for ind in indents:
            tank_name = None
            if ind.decanted_tank_id:
                tank = db.get(FuelTank, ind.decanted_tank_id)
                if tank:
                    tank_name = tank.name

            results.append({
                "id": ind.id,
                "uuid": ind.uuid,
                "indent_number": ind.indent_number,
                "omc_company": ind.omc_company,
                "terminal_name": ind.terminal_name,
                "fuel_type": ind.fuel_type,
                "ordered_liters": ind.ordered_liters,
                "tank_truck_number": ind.tank_truck_number,
                "expected_delivery_date": ind.expected_delivery_date,
                "actual_delivery_date": ind.actual_delivery_date,
                "status": ind.status,
                "decanted_tank_id": ind.decanted_tank_id,
                "decanted_tank_name": tank_name,
                "density_at_15c": ind.density_at_15c,
                "procurement_cost_per_liter": ind.procurement_cost_per_liter,
                "total_invoice_amount": ind.total_invoice_amount,
                "invoice_number": ind.invoice_number,
                "remarks": ind.remarks,
                "created_at": ind.created_at,
                "updated_at": ind.updated_at,
            })
        return results

    def update_indent_status(
        self,
        db: Session,
        indent_uuid: str,
        status: IndentStatus,
        tank_truck_number: str | None = None,
        actual_delivery_date: date | None = None,
        decanted_tank_uuid: str | None = None,
        density_at_15c: float | None = None,
        invoice_number: str | None = None,
        total_invoice_amount: float | None = None,
        remarks: str | None = None,
        actor_id: int | None = None,
    ) -> PurchaseIndent:
        indent = db.scalar(select(PurchaseIndent).where(PurchaseIndent.uuid == indent_uuid))
        if not indent:
            raise ValueError(f"Purchase indent '{indent_uuid}' not found.")

        old_status = indent.status
        indent.status = status

        if tank_truck_number is not None:
            indent.tank_truck_number = tank_truck_number.strip()
        if actual_delivery_date is not None:
            indent.actual_delivery_date = actual_delivery_date
        if density_at_15c is not None:
            indent.density_at_15c = density_at_15c
        if invoice_number is not None:
            indent.invoice_number = invoice_number.strip()
        if total_invoice_amount is not None:
            indent.total_invoice_amount = total_invoice_amount
        if remarks is not None:
            indent.remarks = remarks.strip()

        # If transitioning to DELIVERED and decanted_tank_uuid provided, execute tank delivery decant!
        if status == IndentStatus.DELIVERED and old_status != IndentStatus.DELIVERED:
            if not decanted_tank_uuid:
                raise ValueError("Destination fuel tank must be selected for decanting upon delivery.")

            tank = db.scalar(select(FuelTank).where(FuelTank.uuid == decanted_tank_uuid))
            if not tank:
                raise ValueError(f"Destination tank '{decanted_tank_uuid}' not found.")

            indent.decanted_tank_id = tank.id
            if not indent.actual_delivery_date:
                indent.actual_delivery_date = date.today()

            # Create corresponding TankerDelivery to increase stock automatically
            self.tank_service.create_delivery(
                db=db,
                tank_uuid=tank.uuid,
                delivery_date=indent.actual_delivery_date,
                invoice_number=indent.invoice_number or indent.indent_number,
                quantity_liters=indent.ordered_liters,
                density=indent.density_at_15c,
                supplier_name=indent.omc_company.value,
                remarks=f"Decanted from TT #{indent.tank_truck_number or 'N/A'} (Indent #{indent.indent_number})",
                procurement_rate=indent.procurement_cost_per_liter,
                payment_mode=PaymentMode.CREDIT,
                ignore_capacity=True,
            )

        db.flush()
        self.audit_service.log_action(
            db,
            action="Updated OMC Purchase Indent Status",
            target_table="purchase_indents",
            target_id=str(indent.id),
            actor_id=actor_id,
            old_values={"status": old_status.value},
            new_values={"status": status.value},
        )
        return indent

    def delete_indent(self, db: Session, indent_uuid: str, actor_id: int | None = None) -> None:
        indent = db.scalar(select(PurchaseIndent).where(PurchaseIndent.uuid == indent_uuid))
        if not indent:
            raise ValueError(f"Purchase indent '{indent_uuid}' not found.")

        indent.is_active = False
        indent.status = IndentStatus.CANCELLED
        db.flush()

        self.audit_service.log_action(
            db,
            action="Cancelled OMC Purchase Indent",
            target_table="purchase_indents",
            target_id=str(indent.id),
            actor_id=actor_id,
        )
