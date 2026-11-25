from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas.smart_voucher import VoucherSuggestionResponse, VoucherSuggestRequest
from app.services.smart_voucher_service import SmartVoucherService

router = APIRouter(prefix="/vouchers", tags=["Smart Voucher"])
service = SmartVoucherService()


@router.post("/suggest", response_model=VoucherSuggestionResponse)
def suggest_voucher_fields(
    payload: VoucherSuggestRequest,
    db: Session = Depends(get_db),
):
    """Return auto-fill suggestions and anomaly warnings from vehicle/customer/price context."""
    return service.suggest(db, payload)
