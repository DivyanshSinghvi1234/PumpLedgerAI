from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.stock_variance import (
    StockAlert,
    StockVarianceBulkDipRequest,
    StockVarianceDailySummaryResponse,
    StockVarianceResponse,
)
from app.services.stock_variance_service import StockVarianceService

router = APIRouter(prefix="/stock-variances", tags=["Stock Variance & Loss Detection"])
service = StockVarianceService()


@router.get("/daily", response_model=StockVarianceDailySummaryResponse)
def get_daily_stock_variance(
    variance_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.get_daily_summary(db, variance_date or date.today())


@router.post(
    "/dips",
    response_model=StockVarianceDailySummaryResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def record_daily_dips(
    payload: StockVarianceBulkDipRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dips_map = {item.tank_uuid: item.physical_dip for item in payload.dips}
    service.compute_daily_variance(
        db,
        payload.variance_date,
        physical_dips=dips_map,
        actor_id=current_user.id,
    )
    return service.get_daily_summary(db, payload.variance_date)


@router.get("/alerts", response_model=list[StockAlert])
def get_stock_alerts(
    as_of_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.check_alerts(db, as_of_date or date.today())


@router.get("/tanks/{tank_uuid}/trend", response_model=list[StockVarianceResponse])
def get_tank_variance_trend(
    tank_uuid: str,
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    try:
        return service.get_trend(db, tank_uuid, days=days)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
