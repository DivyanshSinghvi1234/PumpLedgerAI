from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import hash_password
from app.database.base import Base
from app.database.session import SessionLocal, engine
from app.models.user import User
from app.repositories.user_repository import UserRepository


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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

    seed_admin()
