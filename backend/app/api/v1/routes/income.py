from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.enums import IncomeKind, UserRole
from app.core.exceptions import CustomerNotFoundError, IncomeNotFoundError
from app.models.user import User
from app.schemas.income import (
    IncomeCreate,
    IncomeListResponse,
    IncomeResponse,
    IncomeSummaryResponse,
)
from app.services.income_service import IncomeService

router = APIRouter(
    prefix="/income",
    tags=["Income"],
)

service = IncomeService()

# Only managers and admins may record or reverse income lines.
manager = [Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


@router.post(
    "",
    response_model=IncomeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager,
)
def create_income(
    data: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create(db, data, actor_id=current_user.id)
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=IncomeListResponse,
)
def get_incomes(
    income_date: date | None = Query(
        default=None,
        description="Filter income rows by exact date",
    ),
    kind: IncomeKind | None = Query(
        default=None,
        description="Filter by kind (INCOME or EXPENSE)",
    ),
    search: str | None = Query(
        default=None,
        description="Search description or category",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = service.search(
        db,
        income_date=income_date,
        kind=kind,
        search=search,
        page=page,
        page_size=page_size,
    )

    return IncomeListResponse(
        items=items,
        pagination=build_pagination(
            page=page,
            page_size=page_size,
            total_items=total,
        ),
    )


@router.get(
    "/summary",
    response_model=IncomeSummaryResponse,
)
def get_income_summary(
    on_date: date = Query(
        ...,
        description="Date to summarise sales + income for",
    ),
    db: Session = Depends(get_db),
):
    return service.daily_summary(db, on_date=on_date)


@router.get(
    "/categories",
    response_model=list[str],
)
def get_income_categories(
    db: Session = Depends(get_db),
):
    return service.list_categories(db)


@router.delete(
    "/{income_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager,
)
def delete_income(
    income_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete(db, income_uuid, actor_id=current_user.id)
    except IncomeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put(
    "/{income_uuid}",
    response_model=IncomeResponse,
    dependencies=manager,
)
def update_income(
    income_uuid: str,
    data: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update(db, income_uuid, data, actor_id=current_user.id)
    except IncomeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except CustomerNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


# -----------------------------------------------------
# Daily cash sheet endpoints
# -----------------------------------------------------
from app.schemas.daily_cash_sheet import DailyCashSheetCreate, DailyCashSheetResponse
from app.services.daily_cash_sheet_service import DailyCashSheetService

cash_sheet_service = DailyCashSheetService()


@router.get(
    "/cash-sheet",
    response_model=DailyCashSheetResponse | None,
)
def get_daily_cash_sheet(
    on_date: date = Query(..., description="Date for the cash sheet"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return cash_sheet_service.get_by_date(db, on_date)


@router.post(
    "/cash-sheet",
    response_model=DailyCashSheetResponse,
)
def save_daily_cash_sheet(
    data: DailyCashSheetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return cash_sheet_service.upsert(db, data)


