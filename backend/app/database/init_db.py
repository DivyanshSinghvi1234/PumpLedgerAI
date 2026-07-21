from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import hash_password
from app.database.base import Base
from app.database.session import SessionLocal, engine
from app.models.pump import Pump
from app.models.fuel_tank import TankerDelivery
from app.models.user import User
from app.models.user_pump_access import UserPumpAccess
from app.repositories.pump_repository import PumpRepository
from app.repositories.user_repository import UserRepository


# The 3 filling stations to seed
SEED_PUMPS = [
    {
        "name": "Shri Vichaxan Filling Station",
        "code": "SVF",
        "address": None,
    },
    {
        "name": "SardarJi And Sons",
        "code": "SAS",
        "address": None,
    },
    {
        "name": "Doongriwala Filling Station",
        "code": "DFS",
        "address": None,
    },
]


def seed_admin() -> None:
    """Create the default admin user if no admin exists yet."""
    db = SessionLocal()

    try:
        repository = UserRepository()

        existing = repository.get_by_username(
            db,
            settings.DEFAULT_ADMIN_USERNAME,
        )

        if existing is not None:
            return

        admin = User(
            username=settings.DEFAULT_ADMIN_USERNAME,
            full_name=settings.DEFAULT_ADMIN_FULL_NAME,
            password_hash=hash_password(
                settings.DEFAULT_ADMIN_PASSWORD,
            ),
            role=UserRole.ADMIN,
            is_active=True,
        )

        repository.create(db, admin)

    finally:
        db.close()


def seed_pumps() -> None:
    """Create the 3 filling stations if they don't exist yet,
    and ensure the admin user has access to all of them."""
    db = SessionLocal()

    try:
        pump_repo = PumpRepository()
        user_repo = UserRepository()

        created_or_existing = []

        for pump_data in SEED_PUMPS:
            existing = pump_repo.get_by_code(db, pump_data["code"])

            if existing is not None:
                created_or_existing.append(existing)
                continue

            pump = Pump(
                name=pump_data["name"],
                code=pump_data["code"],
                address=pump_data["address"],
            )
            pump = pump_repo.create(db, pump)
            created_or_existing.append(pump)

        # Assign admin user access to all pumps
        admin = user_repo.get_by_username(
            db,
            settings.DEFAULT_ADMIN_USERNAME,
        )

        if admin is not None:
            existing_pump_ids = set(
                pump_repo.get_user_pump_ids(db, admin.id)
            )

            for pump in created_or_existing:
                if pump.id not in existing_pump_ids:
                    db.add(
                        UserPumpAccess(
                            user_id=admin.id,
                            pump_id=pump.id,
                        )
                    )

            db.commit()

    finally:
        db.close()


def check_and_update_schema() -> None:
    """Run self-healing schema updates (e.g. adding last_active_at if missing)."""
    db = SessionLocal()
    try:
        from sqlalchemy import text
        try:
            db.execute(text("SELECT last_active_at FROM users LIMIT 1"))
        except Exception:
            db.rollback()
            db.execute(text("ALTER TABLE users ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE"))
            db.commit()
            print("Successfully added last_active_at column to users table.")

        # vehicles.normalized_number — canonical plate for matching. Backfill
        # existing rows so historical vehicles resolve on the next voucher.
        try:
            db.execute(text("SELECT normalized_number FROM vehicles LIMIT 1"))
        except Exception:
            db.rollback()
            db.execute(text("ALTER TABLE vehicles ADD COLUMN normalized_number VARCHAR(20)"))
            db.commit()

            from app.common.normalization import normalize_vehicle_number

            rows = db.execute(
                text("SELECT id, vehicle_number FROM vehicles")
            ).fetchall()
            for row in rows:
                normalized = normalize_vehicle_number(row.vehicle_number)
                db.execute(
                    text(
                        "UPDATE vehicles SET normalized_number = :n WHERE id = :id"
                    ),
                    {"n": normalized, "id": row.id},
                )
            db.commit()
            print("Successfully added normalized_number column to vehicles table.")

        # Auto-convert any legacy PENDING vouchers to VERIFIED
        try:
            db.execute(text("UPDATE vouchers SET verification_status = 'VERIFIED' WHERE verification_status = 'PENDING'"))
            db.commit()
        except Exception:
            db.rollback()

        # Daily reconciliation fields are additive, so safely backfill them
        # for existing SQLite installations that predate the Alembic revision.
        for table, column, definition in (
            ("nozzles", "tank_id", "INTEGER"),
            ("nozzles", "meter_capacity", "FLOAT NOT NULL DEFAULT 1000000"),
            # Reading-time + interim-6am fields (Alembic 84afd97faf4a). Missing on
            # prod DBs that were built by create_all before this revision, which
            # 500s the meter-readings bulk-form query. TIME/FLOAT are portable
            # across SQLite and PostgreSQL.
            ("nozzle_readings", "opening_time", "TIME"),
            ("nozzle_readings", "closing_time", "TIME"),
            ("nozzle_readings", "interim_6am_reading", "FLOAT"),
            # Alembic 48eed73943a5. Missing on prod DBs built by create_all and
            # stamped past this revision by prestart.sh, so the migration never
            # runs — its absence 500s every SELECT on nozzle_readings (all mapped
            # columns are loaded), including the meter-readings bulk-form query.
            ("nozzle_readings", "testing_liters", "FLOAT NOT NULL DEFAULT 0"),
            ("dip_readings", "deliveries_liters", "FLOAT NOT NULL DEFAULT 0"),
            ("dip_readings", "nozzle_sales_liters", "FLOAT NOT NULL DEFAULT 0"),
            ("dip_readings", "unbilled_cash_variance", "FLOAT NOT NULL DEFAULT 0"),
            ("dip_readings", "physical_leak_variance", "FLOAT NOT NULL DEFAULT 0"),
            ("dip_readings", "variance_tolerance_liters", "FLOAT NOT NULL DEFAULT 0"),
        ):
            try:
                db.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
            except Exception:
                db.rollback()
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
                db.commit()

        # tanker_deliveries timestamp defaults. The table was created (by
        # create_all) without a server DEFAULT on created_at/updated_at on some
        # DBs, so inserts send NULL and hit a NOT NULL violation (500 on every
        # "Add Stock" delivery). Re-assert the default idempotently. Postgres
        # only — SQLite's create_all already applies CURRENT_TIMESTAMP.
        if engine.dialect.name == "postgresql":
            try:
                db.execute(text("ALTER TABLE tanker_deliveries ALTER COLUMN created_at SET DEFAULT now()"))
                db.execute(text("ALTER TABLE tanker_deliveries ALTER COLUMN updated_at SET DEFAULT now()"))
                db.commit()
            except Exception:
                db.rollback()
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    
    check_and_update_schema()

    seed_admin()
    seed_pumps()
