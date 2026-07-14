from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import ALGORITHM
from app.database.session import SessionLocal
from app.models.user import User
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_uuid = payload.get("sub")

        if user_uuid is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = UserRepository().get_by_uuid(db, user_uuid)

    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_roles(*roles: UserRole):
    """Dependency factory: allow only users whose role is in `roles`."""

    def checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )

        return current_user

    return checker




def _get_active_pump_dependency():
    """Factory that creates the real Depends-compatible callable."""
    from fastapi import Header

    def _inner(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        x_pump_uuid: str | None = Header(None, alias="X-Pump-UUID"),
    ):
        if x_pump_uuid is None:
            return None

        from app.services.pump_service import (
            PumpAccessDeniedError,
            PumpNotFoundError,
            PumpService,
        )

        pump_service = PumpService()

        try:
            return pump_service.validate_user_has_pump_access(
                db, current_user, x_pump_uuid
            )
        except PumpNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pump '{x_pump_uuid}' not found.",
            )
        except PumpAccessDeniedError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this pump.",
            )

    return _inner


get_active_pump = _get_active_pump_dependency()


def require_active_pump(
    active_pump = Depends(get_active_pump),
):
    if active_pump is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Pump-UUID header is required.",
        )
    return active_pump

