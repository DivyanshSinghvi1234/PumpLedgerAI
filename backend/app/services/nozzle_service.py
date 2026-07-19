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
        nozzle = self.nozzle_repo.get_by_uuid(db, nozzle_uuid)
        if not nozzle:
            raise ValueError("Nozzle not found")

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

        if prev_reading:
            return prev_reading.closing_reading
        
        # Fallback to configured initial last_reading on Nozzle
        return nozzle.last_reading

    def get_bulk_form(self, db: Session, reading_date: date) -> BulkFormResponse:
        dispensers = self.dispenser_repo.get_all(db)
        items = []

        for dispenser in dispensers:
            if not dispenser.is_active:
                continue
            for nozzle in dispenser.nozzles:
                if not nozzle.is_active:
                    continue
                
                # Fetch saved reading for this nozzle on this date
                reading = self.reading_repo.get_by_date(db, nozzle.id, reading_date)
                
                if reading:
                    opening_reading = reading.opening_reading
                    closing_reading = reading.closing_reading
                    sales = reading.sales
                    opening_time = reading.opening_time.strftime("%H:%M") if reading.opening_time else "19:30"
                    closing_time = reading.closing_time.strftime("%H:%M") if reading.closing_time else "19:30"
                    interim_6am_reading = reading.interim_6am_reading
                else:
                    # Auto-rollover: load previous final reading as opening
                    opening_reading = self.get_opening_readings(db, nozzle.uuid, reading_date)
                    closing_reading = None
                    sales = None
                    opening_time = "19:30"
                    closing_time = "19:30"
                    interim_6am_reading = None

                items.append(
                    BulkFormNozzleItem(
                        nozzle_uuid=nozzle.uuid,
                        nozzle_name=nozzle.name,
                        dispenser_name=dispenser.name,
                        fuel_type=nozzle.fuel_type,
                        opening_reading=opening_reading,
                        closing_reading=closing_reading,
                        sales=sales,
                        opening_time=opening_time,
                        closing_time=closing_time,
                        interim_6am_reading=interim_6am_reading,
                    )
                )

        return BulkFormResponse(reading_date=reading_date, items=items)

    def post_bulk_readings(
        self,
        db: Session,
        data: BulkNozzleReadingCreate,
        actor_id: int | None = None,
    ) -> list[NozzleReading]:
        readings = []
        r_date = data.reading_date

        for item in data.readings:
            nozzle = self.nozzle_repo.get_by_uuid(db, item.nozzle_uuid)
            if not nozzle:
                raise ValueError(f"Nozzle not found for UUID: {item.nozzle_uuid}")

            # Get or calculate opening reading
            opening = item.opening_reading if item.opening_reading is not None else self.get_opening_readings(db, nozzle.uuid, r_date)

            sales = item.closing_reading - opening
            if sales < 0:
                sales = (nozzle.meter_capacity - opening) + item.closing_reading
            if sales > nozzle.meter_capacity * 0.1:
                raise ValueError(f"Meter sales for nozzle '{nozzle.name}' are implausibly high; review the reading.")

            existing = self.reading_repo.get_by_date(db, nozzle.id, r_date)

            # Parse optional time strings
            def parse_time(t: str | None) -> time_type | None:
                if not t:
                    return time_type(19, 30)
                try:
                    h, m = t.split(":")
                    return time_type(int(h), int(m))
                except Exception:
                    return time_type(19, 30)

            opening_time = parse_time(item.opening_time)
            closing_time = parse_time(item.closing_time)

            if existing:
                existing.opening_reading = opening
                existing.closing_reading = item.closing_reading
                existing.sales = sales
                existing.total_sales = sales
                existing.opening_time = opening_time
                existing.closing_time = closing_time
                existing.interim_6am_reading = item.interim_6am_reading
                reading = self.reading_repo.update(db, existing)
            else:
                new_reading = NozzleReading(
                    nozzle_id=nozzle.id,
                    reading_date=r_date,
                    opening_reading=opening,
                    closing_reading=item.closing_reading,
                    sales=sales,
                    total_sales=sales,
                    opening_time=opening_time,
                    closing_time=closing_time,
                    interim_6am_reading=item.interim_6am_reading,
                )
                reading = self.reading_repo.create(db, new_reading)

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
