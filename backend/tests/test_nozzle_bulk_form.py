import pytest
from datetime import date, time as time_type, timedelta
from app.models.pump import Pump
from app.models.fuel_dispenser import FuelDispenser
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.services.nozzle_service import NozzleService
from app.core.enums import FuelType, NozzleStatus

def test_get_bulk_form_time_formatting(db_session):
    # Get or create a pump
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Pump", code="TST", address="Test Address")
        db_session.add(pump)
        db_session.commit()
        db_session.refresh(pump)

    # Create dispenser
    dispenser = FuelDispenser(name="Test Dispenser", status=NozzleStatus.ACTIVE, pump_id=pump.id)
    db_session.add(dispenser)
    db_session.commit()
    db_session.refresh(dispenser)

    # Create nozzle
    nozzle = Nozzle(
        dispenser_id=dispenser.id,
        name="Nozzle 1",
        fuel_type=FuelType.PETROL,
        last_reading=100.0,
        pump_id=pump.id,
    )
    db_session.add(nozzle)
    db_session.commit()
    db_session.refresh(nozzle)

    service = NozzleService()
    test_date = date(2026, 7, 20)

    # Clean existing readings for test_date if any
    db_session.query(NozzleReading).filter(
        NozzleReading.nozzle_id == nozzle.id,
        NozzleReading.reading_date == test_date
    ).delete()
    db_session.commit()

    # Create reading
    reading = NozzleReading(
        nozzle_id=nozzle.id,
        reading_date=test_date,
        opening_reading=100.0,
        closing_reading=200.0,
        sales=100.0,
        total_sales=100.0,
        pump_id=pump.id,
    )
    db_session.add(reading)
    db_session.commit()

    # 1. Test when opening_time and closing_time are None
    reading.opening_time = None
    reading.closing_time = None
    db_session.commit()
    res = service.get_bulk_form(db_session, test_date)
    item = next(i for i in res.items if i.nozzle_uuid == nozzle.uuid)
    assert item.opening_time == "19:30"
    assert item.closing_time == "19:30"

    # 2. Test when opening_time is datetime.time
    reading.opening_time = time_type(8, 5)
    reading.closing_time = time_type(17, 30)
    db_session.commit()
    db_session.refresh(reading)
    res = service.get_bulk_form(db_session, test_date)
    item = next(i for i in res.items if i.nozzle_uuid == nozzle.uuid)
    assert item.opening_time == "08:05"
    assert item.closing_time == "17:30"

    # 3. Test when opening_time is datetime.timedelta (without committing to SQLite)
    reading.opening_time = timedelta(hours=9, minutes=15)
    reading.closing_time = timedelta(hours=18, minutes=0)
    res = service.get_bulk_form(db_session, test_date)
    item = next(i for i in res.items if i.nozzle_uuid == nozzle.uuid)
    assert item.opening_time == "09:15"
    assert item.closing_time == "18:00"

    # 4. Test when opening_time is a string (without committing to SQLite)
    reading.opening_time = "07:45:00"
    reading.closing_time = "16:20"
    res = service.get_bulk_form(db_session, test_date)
    item = next(i for i in res.items if i.nozzle_uuid == nozzle.uuid)
    assert item.opening_time == "07:45"
    assert item.closing_time == "16:20"
