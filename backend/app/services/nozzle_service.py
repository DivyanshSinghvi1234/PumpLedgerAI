from __future__ import annotations

from datetime import date, time as time_type
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.fuel_dispenser import FuelDispenser
from app.models.fuel_tank import FuelTank
from app.repositories.nozzle_repository import (
    NozzleRepository,
    NozzleReadingRepository,
    FuelDispenserRepository,
)
from app.schemas.nozzle import (
    NozzleCreate,
    NozzleUpdate,
    FuelDispenserCreate,
    FuelDispenserUpdate,
    BulkNozzleReadingCreate,
    BulkFormNozzleItem,
    BulkFormResponse,
)

from app.core.enums import FuelType
from app.services.audit_log_service import AuditLogService


class NozzleService:

    def __init__(self):
        self.dispenser_repo = FuelDispenserRepository()
        self.nozzle_repo = NozzleRepository()
        self.reading_repo = NozzleReadingRepository()
        self.audit_service = AuditLogService()

    def create_dispenser(self, db: Session, data: FuelDispenserCreate, actor_id: int | None = None) -> FuelDispenser:
        existing = self.dispenser_repo.get_by_name(db, data.name)
        if existing:
            raise ValueError(f"Fuel dispenser with name '{data.name}' already exists")
        
        dispenser = FuelDispenser(
            name=data.name,
            status=data.status,
        )
        dispenser = self.dispenser_repo.create(db, dispenser)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Created Fuel Dispenser",
            target_table="fuel_dispensers",
            target_id=str(dispenser.id),
            actor_id=actor_id,
            new_values={
                "name": dispenser.name,
                "status": dispenser.status.value,
            }
        )
        return dispenser

    def update_dispenser(
        self,
        db: Session,
        dispenser_uuid: str,
        data: FuelDispenserUpdate,
        actor_id: int | None = None,
    ) -> FuelDispenser:
        dispenser = self.dispenser_repo.get_by_uuid(db, dispenser_uuid)
        if not dispenser:
            raise ValueError("Fuel dispenser not found")

        old_values = {
            "name": dispenser.name,
            "status": dispenser.status.value,
        }

        if data.name is not None:
            cleaned_name = data.name.strip()
            if not cleaned_name:
                raise ValueError("Dispenser name cannot be empty")
            if cleaned_name != dispenser.name:
                existing = self.dispenser_repo.get_by_name(db, cleaned_name)
                if existing:
                    raise ValueError(f"Fuel dispenser with name '{cleaned_name}' already exists")
                dispenser.name = cleaned_name

        if data.status is not None:
            dispenser.status = data.status

        dispenser = self.dispenser_repo.update(db, dispenser)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Updated Fuel Dispenser",
            target_table="fuel_dispensers",
            target_id=str(dispenser.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values={
                "name": dispenser.name,
                "status": dispenser.status.value,
            }
        )
        return dispenser

    def delete_dispenser(self, db: Session, dispenser_uuid: str, actor_id: int | None = None) -> None:
        dispenser = self.dispenser_repo.get_by_uuid(db, dispenser_uuid)
        if not dispenser:
            raise ValueError("Fuel dispenser not found")

        old_values = {
            "name": dispenser.name,
            "status": dispenser.status.value,
        }

        self.dispenser_repo.delete(db, dispenser)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Fuel Dispenser",
            target_table="fuel_dispensers",
            target_id=str(dispenser.id),
            actor_id=actor_id,
            old_values=old_values,
        )

    def get_dispensers(self, db: Session) -> list[FuelDispenser]:
        return self.dispenser_repo.get_all(db)

    def create_nozzle(
        self,
        db: Session,
        dispenser_uuid: str,
        data: NozzleCreate,
        actor_id: int | None = None,
    ) -> Nozzle:
        dispenser = self.dispenser_repo.get_by_uuid(db, dispenser_uuid)
        if not dispenser:
            raise ValueError("Fuel dispenser not found")

        # Limit to 4 nozzles per dispenser
        existing_nozzles = self.nozzle_repo.get_by_dispenser(db, dispenser.id)
        if len(existing_nozzles) >= 4:
            raise ValueError("A fuel dispenser cannot have more than 4 nozzles")

        # Unique name constraint
        name_exists = self.nozzle_repo.get_by_name(db, data.name)
        if name_exists:
            raise ValueError(f"Nozzle with name '{data.name}' already exists")
        tank_id = None
        if data.tank_uuid:
            tank = db.scalar(select(FuelTank).where(FuelTank.uuid == data.tank_uuid, FuelTank.is_active == True))
            if not tank:
                raise ValueError("Fuel tank not found")
            if tank.fuel_type != data.fuel_type:
                raise ValueError("Nozzle fuel type must match its tank")
            tank_id = tank.id

        nozzle = Nozzle(
            dispenser_id=dispenser.id,
            name=data.name,
            fuel_type=data.fuel_type,
            last_reading=data.last_reading,
            tank_id=tank_id,
            meter_capacity=data.meter_capacity,
        )
        nozzle = self.nozzle_repo.create(db, nozzle)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Created Nozzle",
            target_table="nozzles",
            target_id=str(nozzle.id),
            actor_id=actor_id,
            new_values={
                "name": nozzle.name,
                "fuel_type": nozzle.fuel_type.value,
                "last_reading": str(nozzle.last_reading),
                "dispenser_id": str(dispenser.id),
            }
        )
        return nozzle

    def update_nozzle(
        self,
        db: Session,
        nozzle_uuid: str,
        data: NozzleUpdate,
        actor_id: int | None = None,
    ) -> Nozzle:
        nozzle = self.nozzle_repo.get_by_uuid(db, nozzle_uuid)
        if not nozzle:
            raise ValueError("Nozzle not found")

        old_values = {
            "name": nozzle.name,
            "fuel_type": nozzle.fuel_type.value,
            "last_reading": str(nozzle.last_reading),
        }

        if data.name is not None:
            cleaned_name = data.name.strip()
            if not cleaned_name:
                raise ValueError("Nozzle name cannot be empty")
            if cleaned_name != nozzle.name:
                existing = self.nozzle_repo.get_by_name(db, cleaned_name)
                if existing:
                    raise ValueError(f"Nozzle with name '{cleaned_name}' already exists")
            nozzle.name = cleaned_name
        if data.meter_capacity is not None:
            if data.meter_capacity <= nozzle.last_reading:
                raise ValueError("Meter capacity must exceed the current reading")
            nozzle.meter_capacity = data.meter_capacity
        if data.tank_uuid is not None:
            tank = db.scalar(select(FuelTank).where(FuelTank.uuid == data.tank_uuid, FuelTank.is_active == True))
            if not tank:
                raise ValueError("Fuel tank not found")
            if tank.fuel_type != (data.fuel_type or nozzle.fuel_type):
                raise ValueError("Nozzle fuel type must match its tank")
            nozzle.tank_id = tank.id

        if data.fuel_type is not None:
            nozzle.fuel_type = data.fuel_type

        if data.last_reading is not None:
            nozzle.last_reading = data.last_reading

        nozzle = self.nozzle_repo.update(db, nozzle)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Updated Nozzle",
            target_table="nozzles",
            target_id=str(nozzle.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values={
                "name": nozzle.name,
                "fuel_type": nozzle.fuel_type.value,
                "last_reading": str(nozzle.last_reading),
            }
        )
        return nozzle

    def delete_nozzle(self, db: Session, nozzle_uuid: str, actor_id: int | None = None) -> None:
        nozzle = self.nozzle_repo.get_by_uuid(db, nozzle_uuid)
        if not nozzle:
            raise ValueError("Nozzle not found")

        old_values = {
            "name": nozzle.name,
            "fuel_type": nozzle.fuel_type.value,
            "last_reading": str(nozzle.last_reading),
        }

        self.nozzle_repo.delete(db, nozzle)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Nozzle",
            target_table="nozzles",
            target_id=str(nozzle.id),
            actor_id=actor_id,
            old_values=old_values,
        )

    def get_opening_readings(
        self,
        db: Session,
        nozzle_uuid: str,
        reading_date: date,
    ) -> float:
        try:
            nozzle = self.nozzle_repo.get_by_uuid(db, nozzle_uuid)
            if not nozzle:
                return 0.0

            # Find the latest reading before reading_date
            prev_reading = db.scalar(
                select(NozzleReading)
                .where(
                    NozzleReading.nozzle_id == nozzle.id,
                    NozzleReading.reading_date < reading_date
                )
                .order_by(desc(NozzleReading.reading_date))
                .limit(1)
            )

            if prev_reading and prev_reading.closing_reading is not None:
                return prev_reading.closing_reading
            
            # Fallback to configured initial last_reading on Nozzle
            return nozzle.last_reading if (nozzle and nozzle.last_reading is not None) else 0.0
        except Exception:
            return 0.0

    def get_bulk_form(self, db: Session, reading_date: date) -> BulkFormResponse:
        dispensers = self.dispenser_repo.get_all(db)
        items = []

        def safe_format_time(t) -> str:
            if not t:
                return "19:30"
            if hasattr(t, "strftime"):
                try:
                    return t.strftime("%H:%M")
                except Exception:
                    pass
            import datetime
            if isinstance(t, datetime.timedelta):
                tot = int(t.total_seconds())
                h = (tot // 3600) % 24
                m = (tot % 3600) // 60
                return f"{h:02d}:{m:02d}"
            t_str = str(t).strip()
            if ":" in t_str:
                parts = t_str.split(":")
                if len(parts) >= 2:
                    try:
                        h_val = int(parts[0])
                        m_val = int(parts[1])
                        return f"{h_val:02d}:{m_val:02d}"
                    except ValueError:
                        pass
            return "19:30"

        for dispenser in dispensers:
            # ponytail: match the config tab, which lists every dispenser/nozzle
            # regardless of the legacy is_active flag (the UI manages `status`,
            # not is_active). Ceiling: OUT_OF_ORDER nozzles still appear here —
            # upgrade to filtering on `status == ACTIVE` if that's ever wanted.
            for nozzle in dispenser.nozzles:

                # Fetch saved reading for this nozzle on this date
                reading = self.reading_repo.get_by_date(db, nozzle.id, reading_date)
                
                if reading:
                    opening_reading = reading.opening_reading if reading.opening_reading is not None else 0.0
                    closing_reading = reading.closing_reading
                    sales = reading.sales
                    opening_time = safe_format_time(reading.opening_time)
                    closing_time = safe_format_time(reading.closing_time)
                    interim_6am_reading = reading.interim_6am_reading
                    testing = reading.testing_liters if reading.testing_liters is not None else 0.0
                else:
                    # Auto-rollover: load previous final reading as opening
                    opening_reading = self.get_opening_readings(db, nozzle.uuid, reading_date)
                    if opening_reading is None:
                        opening_reading = 0.0
                    closing_reading = None
                    sales = None
                    opening_time = "19:30"
                    closing_time = "19:30"
                    interim_6am_reading = None
                    testing = 0.0

                # Ensure fuel type has fallback
                fuel_type_val = nozzle.fuel_type if nozzle.fuel_type else FuelType.PETROL

                items.append(
                    BulkFormNozzleItem(
                        nozzle_uuid=nozzle.uuid or "",
                        nozzle_name=nozzle.name or "Unknown Nozzle",
                        dispenser_name=dispenser.name or "Unknown Dispenser",
                        fuel_type=fuel_type_val,
                        opening_reading=opening_reading,
                        closing_reading=closing_reading,
                        sales=sales,
                        opening_time=opening_time,
                        closing_time=closing_time,
                        interim_6am_reading=interim_6am_reading,
                        testing=testing,
                    )
                )

        return BulkFormResponse(reading_date=reading_date, items=items)

    def post_bulk_readings(
        self,
        db: Session,
        data: BulkNozzleReadingCreate,
        actor_id: int | None = None,
    ) -> list[NozzleReading]:
        from app.services.fuel_tank_service import FuelTankService
        tank_service = FuelTankService()
        readings = []
        r_date = data.reading_date

        def parse_time(t: str | None) -> time_type | None:
            if not t:
                return time_type(19, 30)
            try:
                h, m = t.split(":")
                return time_type(int(h), int(m))
            except Exception:
                return time_type(19, 30)

        # ── Pass 1: resolve + validate the WHOLE batch before writing anything.
        # A reading that empties a tank, or a selling nozzle with no tank linked,
        # must fail the whole save with a warning — never a partial commit.
        plan: list[dict] = []
        net_deduction: dict[int, float] = {}  # tank_id -> net liters removed by this batch

        for item in data.readings:
            nozzle = self.nozzle_repo.get_by_uuid(db, item.nozzle_uuid)
            if not nozzle:
                raise ValueError(f"Nozzle not found for UUID: {item.nozzle_uuid}")

            opening = item.opening_reading if item.opening_reading is not None else self.get_opening_readings(db, nozzle.uuid, r_date)

            gross_sales = item.closing_reading - opening
            if gross_sales < 0:
                gross_sales = (nozzle.meter_capacity - opening) + item.closing_reading
            if gross_sales > nozzle.meter_capacity * 0.1:
                raise ValueError(f"Meter sales for nozzle '{nozzle.name}' are implausibly high; review the reading.")

            testing_liters = item.testing_liters or 0.0
            sales = gross_sales + testing_liters

            existing = self.reading_repo.get_by_date(db, nozzle.id, r_date)
            old_tank_id = existing.nozzle.tank_id if existing else None
            old_sales = existing.sales if existing else 0.0

            # A nozzle that dispensed fuel must be tied to a storage tank so the
            # stock can be drawn down. Zero-sales readings are allowed unlinked.
            if not nozzle.tank_id and sales > 0:
                raise ValueError(
                    f"Nozzle '{nozzle.name}' is not linked to a storage tank. "
                    f"Configure its tank in the dispenser settings before recording sales."
                )

            # Accumulate the net draw-down per tank so we can reject the batch if
            # any tank would go negative (physically impossible = data error).
            if nozzle.tank_id:
                if existing and old_tank_id and old_tank_id != nozzle.tank_id:
                    net_deduction[old_tank_id] = net_deduction.get(old_tank_id, 0.0) - old_sales
                    net_deduction[nozzle.tank_id] = net_deduction.get(nozzle.tank_id, 0.0) + sales
                else:
                    diff = sales - old_sales if existing else sales
                    net_deduction[nozzle.tank_id] = net_deduction.get(nozzle.tank_id, 0.0) + diff

            plan.append({
                "item": item, "nozzle": nozzle, "existing": existing,
                "opening": opening, "sales": sales, "testing_liters": testing_liters,
                "old_tank_id": old_tank_id, "old_sales": old_sales,
            })

        for tank_id, removed in net_deduction.items():
            tank = db.get(FuelTank, tank_id)
            if tank and tank.current_stock_liters - removed < 0:
                raise ValueError(
                    f"Tank '{tank.name}' would run dry: only "
                    f"{tank.current_stock_liters:.1f} L in stock but this entry draws "
                    f"{removed:.1f} L. Record a stock delivery first, then save the readings."
                )

        # ── Pass 2: everything validated — commit the writes.
        for p in plan:
            item, nozzle, existing = p["item"], p["nozzle"], p["existing"]
            opening, sales, testing_liters = p["opening"], p["sales"], p["testing_liters"]
            opening_time = parse_time(item.opening_time)
            closing_time = parse_time(item.closing_time)

            if existing:
                old_sales = p["old_sales"]
                existing.opening_reading = opening
                existing.closing_reading = item.closing_reading
                existing.testing_liters = testing_liters
                existing.sales = sales
                existing.total_sales = sales
                existing.opening_time = opening_time
                existing.closing_time = closing_time
                existing.interim_6am_reading = item.interim_6am_reading
                reading = self.reading_repo.update(db, existing)

                # Deduct stock based on differences
                if nozzle.tank_id:
                    # If tank changed, restore to old tank and deduct from new tank
                    if p["old_tank_id"] and p["old_tank_id"] != nozzle.tank_id:
                        tank_service.restore_tank_stock(db, p["old_tank_id"], old_sales)
                        tank_service.deduct_tank_stock(db, nozzle.tank_id, sales)
                    else:
                        diff = sales - old_sales
                        tank_service.deduct_tank_stock(db, nozzle.tank_id, diff)
            else:
                new_reading = NozzleReading(
                    nozzle_id=nozzle.id,
                    reading_date=r_date,
                    opening_reading=opening,
                    closing_reading=item.closing_reading,
                    testing_liters=testing_liters,
                    sales=sales,
                    total_sales=sales,
                    opening_time=opening_time,
                    closing_time=closing_time,
                    interim_6am_reading=item.interim_6am_reading,
                )
                reading = self.reading_repo.create(db, new_reading)

                # Deduct stock for new reading
                if nozzle.tank_id:
                    tank_service.deduct_tank_stock(db, nozzle.tank_id, sales)

            # Update the nozzle's last_reading (latest state)
            nozzle.last_reading = item.closing_reading
            self.nozzle_repo.update(db, nozzle)

            readings.append(reading)

        if readings:
            self.audit_service.log_action(
                db,
                action="Saved Meter Readings",
                target_table="nozzle_readings",
                target_id=str(readings[0].id),
                actor_id=actor_id,
                new_values={
                    "reading_date": str(r_date),
                    "count": len(readings),
                }
            )

        return readings

    def get_all_readings(self, db: Session) -> list[NozzleReading]:
        return self.reading_repo.get_all_ordered(db)
