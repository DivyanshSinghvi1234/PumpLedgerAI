from __future__ import annotations

from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.enums import FuelType, PaymentMode
from app.models.user import User
from app.schemas.review import ReviewResponse
from app.schemas.smart_voucher import (
    VoucherSuggestRequest,
    VoucherSuggestionResponse,
)
from app.schemas.voucher import VoucherCreate
from app.services.smart_voucher_service import SmartVoucherService
from app.services.voucher_service import VoucherService

router = APIRouter(prefix="/vouchers", tags=["Smart Voucher"])
service = SmartVoucherService()
voucher_service = VoucherService()


class BulkApproveOCRRequest(BaseModel):
    items: list[ReviewResponse]
    min_confidence: float = Field(default=0.90, ge=0.5, le=1.0)


@router.post("/suggest", response_model=VoucherSuggestionResponse)
def suggest_voucher_fields(
    payload: VoucherSuggestRequest,
    db: Session = Depends(get_db),
):
    """Return auto-fill suggestions and anomaly warnings from vehicle/customer/price context."""
    return service.suggest(db, payload)


@router.post("/bulk-approve-ocr")
def bulk_approve_ocr_slips(
    payload: BulkApproveOCRRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Zero-touch approve high-confidence, error-free, anomaly-free OCR slips in one batch."""
    approved_indices: list[int] = []
    skipped_reasons: list[dict] = []

    for idx, item in enumerate(payload.items):
        ocr = item.ocr
        if item.validation.errors:
            skipped_reasons.append({"index": idx, "reason": item.validation.errors[0]})
            continue
        if ocr.confidence < payload.min_confidence:
            skipped_reasons.append(
                {"index": idx, "reason": f"Confidence {ocr.confidence:.0%} < {payload.min_confidence:.0%}"}
            )
            continue
        if not ocr.invoice_number or not ocr.fuel_type or not ocr.quantity_liters or not ocr.rate_per_liter:
            skipped_reasons.append({"index": idx, "reason": "Missing invoice/fuel/qty/rate"})
            continue

        qty = Decimal(str(ocr.quantity_liters))
        rate = Decimal(str(ocr.rate_per_liter))
        total = Decimal(str(ocr.total_amount))
        if abs((qty * rate) - total) > Decimal("2.00"):
            skipped_reasons.append({"index": idx, "reason": "Quantity × Rate does not match total"})
            continue

        inv_date = ocr.invoice_date or date.today()
        suggestion = service.suggest(
            db,
            VoucherSuggestRequest(
                vehicle_number=ocr.vehicle_number,
                customer_name=ocr.customer_name,
                fuel_type=ocr.fuel_type,
                quantity_liters=qty,
                total_amount=total,
                invoice_date=inv_date,
            ),
        )
        blocking = [
            w for w in suggestion.warnings if w.type in ("POSSIBLE_DUPLICATE", "UNUSUAL_QUANTITY")
        ]
        if blocking:
            skipped_reasons.append({"index": idx, "reason": blocking[0].message})
            continue

        pay_mode = suggestion.payment_mode or PaymentMode.CASH
        try:
            v_create = VoucherCreate(
                invoice_number=ocr.invoice_number,
                invoice_date=inv_date,
                customer_uuid=suggestion.customer_uuid,
                customer_name=suggestion.customer_name or ocr.customer_name,
                vehicle_uuid=suggestion.vehicle_uuid,
                vehicle_number=suggestion.normalized_vehicle_number or ocr.vehicle_number,
                fuel_type=FuelType(ocr.fuel_type) if isinstance(ocr.fuel_type, str) else ocr.fuel_type,
                quantity_liters=qty,
                rate_per_liter=rate,
                total_amount=total,
                payment_mode=pay_mode,
                ocr_confidence=ocr.confidence,
            )
            voucher_service.create(db, v_create, actor_id=current_user.id)
            approved_indices.append(idx)
        except Exception as exc:
            skipped_reasons.append({"index": idx, "reason": str(exc)})

    return {
        "approved_count": len(approved_indices),
        "skipped_count": len(skipped_reasons),
        "approved_indices": approved_indices,
        "skipped_reasons": skipped_reasons,
    }
