from __future__ import annotations

from datetime import date
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.fuel_dispenser import FuelDispenser
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

    def create_dispenser(self, db: Session, data: FuelDispenserCreate) -> FuelDispenser:
        existing = self.dispenser_repo.get_by_name(db, data.name)
        if existing:
            raise ValueError(f"Fuel dispenser with name '{data.name}' already exists")
        
        dispenser = FuelDispenser(
            name=data.name,
            status=data.status,
        )
        return self.dispenser_repo.create(db, dispenser)

    def update_dispenser(
        self,
        db: Session,
        dispenser_uuid: str,
        data: FuelDispenserUpdate,
    ) -> FuelDispenser:
        dispenser = self.dispenser_repo.get_by_uuid(db, dispenser_uuid)
        if not dispenser:
            raise ValueError("Fuel dispenser not found")

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

        return self.dispenser_repo.update(db, dispenser)

    def delete_dispenser(self, db: Session, dispenser_uuid: str) -> None:
        dispenser = self.dispenser_repo.get_by_uuid(db, dispenser_uuid)
        if not dispenser:
            raise ValueError("Fuel dispenser not found")
        self.dispenser_repo.delete(db, dispenser)

    def get_dispensers(self, db: Session) -> list[FuelDispenser]:
        return self.dispenser_repo.get_all(db)

    def create_nozzle(
        self,
        db: Session,
        dispenser_uuid: str,
        data: NozzleCreate,
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

        nozzle = Nozzle(
            dispenser_id=dispenser.id,
            name=data.name,
            fuel_type=data.fuel_type,
            last_reading=data.last_reading,
        )
        return self.nozzle_repo.create(db, nozzle)

    def update_nozzle(
        self,
        db: Session,
        nozzle_uuid: str,
        data: NozzleUpdate,
    ) -> Nozzle:
        nozzle = self.nozzle_repo.get_by_uuid(db, nozzle_uuid)
        if not nozzle:
            raise ValueError("Nozzle not found")

        if data.name is not None:
            cleaned_name = data.name.strip()
            if not cleaned_name:
                raise ValueError("Nozzle name cannot be empty")
            if cleaned_name != nozzle.name:
                existing = self.nozzle_repo.get_by_name(db, cleaned_name)
                if existing:
                    raise ValueError(f"Nozzle with name '{cleaned_name}' already exists")
                nozzle.name = cleaned_name

        if data.fuel_type is not None:
            nozzle.fuel_type = data.fuel_type

        if data.last_reading is not None:
            nozzle.last_reading = data.last_reading

        return self.nozzle_repo.update(db, nozzle)

    def delete_nozzle(self, db: Session, nozzle_uuid: str) -> None:
        nozzle = self.nozzle_repo.get_by_uuid(db, nozzle_uuid)
        if not nozzle:
            raise ValueError("Nozzle not found")
        self.nozzle_repo.delete(db, nozzle)

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
                else:
                    # Auto-rollover: load previous final reading as opening
                    opening_reading = self.get_opening_readings(db, nozzle.uuid, reading_date)
                    closing_reading = None
                    sales = None

                items.append(
                    BulkFormNozzleItem(
                        nozzle_uuid=nozzle.uuid,
                        nozzle_name=nozzle.name,
                        dispenser_name=dispenser.name,
                        fuel_type=nozzle.fuel_type,
                        opening_reading=opening_reading,
                        closing_reading=closing_reading,
                        sales=sales,
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

            if item.closing_reading < opening:
                raise ValueError(
                    f"Closing reading ({item.closing_reading}) on nozzle '{nozzle.name}' "
                    f"cannot be less than opening reading ({opening})"
                )

            sales = item.closing_reading - opening

            existing = self.reading_repo.get_by_date(db, nozzle.id, r_date)
            if existing:
                existing.opening_reading = opening
                existing.closing_reading = item.closing_reading
                existing.sales = sales
                existing.total_sales = sales
                reading = self.reading_repo.update(db, existing)
            else:
                new_reading = NozzleReading(
                    nozzle_id=nozzle.id,
                    reading_date=r_date,
                    opening_reading=opening,
                    closing_reading=item.closing_reading,
                    sales=sales,
                    total_sales=sales,
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
