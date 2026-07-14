from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import InvalidPasswordError
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
)
from app.schemas.user import PasswordChange, UserResponse
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

service = AuthService()
user_service = UserService()


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):

    token = service.login(
        db=db,
        username=credentials.username,
        password=credentials.password,
    )

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    return TokenResponse(
        access_token=token,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_service.get_by_uuid(db, current_user.uuid)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_service.change_password(
            db=db,
            user=current_user,
            current_password=data.current_password,
            new_password=data.new_password,
        )

    except InvalidPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
