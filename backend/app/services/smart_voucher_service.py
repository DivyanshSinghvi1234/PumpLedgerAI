from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from difflib import SequenceMatcher
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.normalization import normalize_vehicle_number
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.voucher import Voucher
from app.repositories.customer_repository import CustomerRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.schemas.smart_voucher import (
    FuzzyCustomerCandidate,
    SuggestionWarning,
    VoucherSuggestionResponse,
    VoucherSuggestRequest,
)
from app.services.price_schedule_service import PriceScheduleService


def _levenshtein(a: str, b: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    prev = list(range(len(b) + 1))
    for i, ch_a in enumerate(a, start=1):
        curr = [i]
        for j, ch_b in enumerate(b, start=1):
            cost = 0 if ch_a == ch_b else 1
            curr.append(min(curr[-1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = curr
    return prev[-1]


def _normalize_company_tokens(name: str) -> str:
    """Normalize a business/customer name for fuzzy comparison."""
    cleaned = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    stopwords = {"pvt", "ltd", "private", "limited", "llp", "co", "corp", "inc", "m/s", "ms"}
    tokens = [t for t in cleaned.split() if t and t not in stopwords]
    return " ".join(tokens)


class SmartVoucherService:
    """Provides context-aware auto-fill suggestions and anomaly warnings for vouchers."""

    def __init__(self) -> None:
        self.vehicle_repo = VehicleRepository()
        self.customer_repo = CustomerRepository()
        self.price_service = PriceScheduleService()

    def _match_vehicle(self, db: Session, raw_plate: str | None) -> tuple[Vehicle | None, str | None, float]:
        normalized = normalize_vehicle_number(raw_plate)
        if not normalized:
            return None, None, 0.0

        exact = self.vehicle_repo.get_by_normalized(db, normalized)
        if exact is not None:
            return exact, normalized, 1.0

        # Fallback: single-character OCR slip on plates of length >= 6
        if len(normalized) >= 6:
            candidates = self.vehicle_repo.get_all_active_with_customer(db)
            close: list[Vehicle] = []
            for v in candidates:
                v_norm = v.normalized_number or normalize_vehicle_number(v.vehicle_number)
                if v_norm and abs(len(v_norm) - len(normalized)) <= 1 and _levenshtein(normalized, v_norm) <= 1:
                    close.append(v)
            if len(close) == 1:
                return close[0], normalized, 0.85

        return None, normalized, 0.0

    def _fuzzy_match_customers(
        self,
        db: Session,
        raw_name: str,
        limit: int = 4,
    ) -> list[FuzzyCustomerCandidate]:
        query = raw_name.strip()
        if len(query) < 2:
            return []

        q_lower = query.lower()
        q_tokens = _normalize_company_tokens(query)
        customers = self.customer_repo.get_all_active(db)
        scored: list[tuple[float, Customer]] = []

        for cust in customers:
            c_name = cust.name.strip()
            c_lower = c_name.lower()
            c_tokens = _normalize_company_tokens(c_name)

            edit_dist = _levenshtein(q_lower, c_lower)
            tok_edit_dist = _levenshtein(q_tokens, c_tokens) if (q_tokens and c_tokens) else 999
            seq_ratio = SequenceMatcher(None, q_lower, c_lower).ratio()
            tok_ratio = SequenceMatcher(None, q_tokens, c_tokens).ratio() if (q_tokens and c_tokens) else 0.0

            contains_boost = 0.0
            if q_lower in c_lower or (q_tokens and q_tokens in c_tokens):
                contains_boost = 0.88

            score = max(seq_ratio, tok_ratio, contains_boost)
            if edit_dist <= 2 or tok_edit_dist <= 2:
                score = max(score, 0.90 - 0.04 * min(edit_dist, tok_edit_dist))

            if score >= 0.62 or edit_dist <= 2 or tok_edit_dist <= 2:
                scored.append((round(min(score, 0.99), 2), cust))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            FuzzyCustomerCandidate(
                customer_uuid=str(cust.uuid),
                customer_name=cust.name,
                customer_code=cust.customer_code,
                mobile=cust.mobile,
                score=score,
            )
            for score, cust in scored[:limit]
        ]

    def _find_duplicate_voucher(
        self,
        db: Session,
        *,
        target_date: date,
        vehicle: Vehicle | None,
        normalized_plate: str | None,
        customer: Customer | None,
        total_amount: Decimal | None,
        exclude_voucher_uuid: str | None,
    ) -> Voucher | None:
        if total_amount is None or total_amount <= Decimal("0"):
            return None
        if vehicle is None and not normalized_plate and customer is None:
            return None

        stmt = select(Voucher).where(
            Voucher.invoice_date == target_date,
            Voucher.is_active.is_(True),
        )
        if exclude_voucher_uuid:
            stmt = stmt.where(Voucher.uuid != exclude_voucher_uuid)

        same_day_vouchers = list(db.scalars(stmt).all())
        amt = float(total_amount)
        tol = max(amt * 0.05, 1.0)

        for v in same_day_vouchers:
            same_vehicle = False
            if vehicle is not None and v.vehicle_id == vehicle.id:
                same_vehicle = True
            elif normalized_plate and normalize_vehicle_number(v.vehicle_number) == normalized_plate:
                same_vehicle = True

            same_customer = customer is not None and v.customer_id == customer.id
            if not (same_vehicle or same_customer):
                continue

            if abs(float(v.total_amount) - amt) <= tol:
                return v

        return None

    def suggest(self, db: Session, req: VoucherSuggestRequest) -> VoucherSuggestionResponse:
        warnings: list[SuggestionWarning] = []
        target_date = req.invoice_date or date.today()

        vehicle, normalized_plate, plate_conf = self._match_vehicle(db, req.vehicle_number)
        vehicle_behavior = (
            self.vehicle_repo.get_vehicle_behavior(db, vehicle.id)
            if vehicle is not None
            else None
        )

        # Resolve customer: explicit UUID > vehicle owner > exact name > fuzzy match
        resolved_customer: Customer | None = None
        customer_conf = 0.0

        if req.customer_uuid is not None:
            resolved_customer = self.customer_repo.get_by_uuid(db, str(req.customer_uuid))
            if resolved_customer:
                customer_conf = 1.0
        elif vehicle is not None and vehicle.customer is not None:
            resolved_customer = vehicle.customer
            customer_conf = 0.95 if plate_conf >= 0.99 else 0.85
        elif req.customer_name and req.customer_name.strip():
            exact_cust = self.customer_repo.get_by_name(db, req.customer_name)
            if exact_cust is not None:
                resolved_customer = exact_cust
                customer_conf = 0.98
            else:
                candidates = self._fuzzy_match_customers(db, req.customer_name)
                if candidates:
                    best = candidates[0]
                    warnings.append(
                        SuggestionWarning(
                            type="FUZZY_CUSTOMER_MATCH",
                            message=f"Did you mean '{best.customer_name}'?",
                            candidates=candidates,
                        )
                    )

        # Fuel type suggestion from vehicle history
        suggested_fuel = req.fuel_type
        fuel_conf = 0.0
        if vehicle_behavior and vehicle_behavior["modal_fuel_type"] is not None:
            if req.fuel_type is None:
                suggested_fuel = vehicle_behavior["modal_fuel_type"]
            fuel_conf = vehicle_behavior["fuel_type_confidence"]

        # Active fuel rate lookup
        at_time = (
            datetime.now(timezone.utc)
            if target_date == date.today()
            else datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc)
        )
        rate_per_liter: Decimal | None = None
        effective_fuel = req.fuel_type or suggested_fuel
        if effective_fuel is not None:
            rate_per_liter = self.price_service.get_active_rate(db, effective_fuel, at_time)

        # Payment mode prediction: vehicle history first, then customer history
        suggested_mode = None
        mode_conf = 0.0
        if vehicle_behavior and vehicle_behavior["modal_payment_mode"] is not None:
            suggested_mode = vehicle_behavior["modal_payment_mode"]
            mode_conf = vehicle_behavior["payment_mode_confidence"]
        elif resolved_customer is not None:
            cust_mode = self.customer_repo.get_customer_payment_mode(db, resolved_customer.id)
            if cust_mode is not None:
                suggested_mode, mode_conf = cust_mode

        # Quantity outlier detection
        avg_qty = vehicle_behavior["avg_quantity"] if vehicle_behavior else None
        sample_count = vehicle_behavior["sample_count"] if vehicle_behavior else 0
        if (
            req.quantity_liters is not None
            and float(req.quantity_liters) > 0
            and vehicle is not None
            and sample_count >= 3
            and avg_qty is not None
            and avg_qty > 0
        ):
            qty = float(req.quantity_liters)
            std = vehicle_behavior["std_quantity"] or 0.0
            upper = max(avg_qty + 2.0 * std, avg_qty * 2.0)
            lower = min(avg_qty * 0.25, max(0.0, avg_qty - 2.0 * std))
            if qty > upper or (lower > 0 and qty < lower):
                ratio = round(qty / avg_qty, 1)
                warnings.append(
                    SuggestionWarning(
                        type="UNUSUAL_QUANTITY",
                        message=(
                            f"Quantity {qty:g} L is unusual for {vehicle.vehicle_number} "
                            f"(avg {avg_qty:g} L over {sample_count} fills, {ratio}x). Possible OCR/entry error?"
                        ),
                    )
                )

        # Duplicate voucher detection
        dup = self._find_duplicate_voucher(
            db,
            target_date=target_date,
            vehicle=vehicle,
            normalized_plate=normalized_plate,
            customer=resolved_customer,
            total_amount=req.total_amount,
            exclude_voucher_uuid=str(req.exclude_voucher_uuid) if req.exclude_voucher_uuid else None,
        )
        if dup is not None:
            warnings.append(
                SuggestionWarning(
                    type="POSSIBLE_DUPLICATE",
                    message=(
                        f"Possible duplicate of Invoice #{dup.invoice_number} "
                        f"on {dup.invoice_date.isoformat()} for ₹{float(dup.total_amount):,.2f}."
                    ),
                    duplicate_uuid=str(dup.uuid),
                    duplicate_invoice_number=dup.invoice_number,
                )
            )

        return VoucherSuggestionResponse(
            normalized_vehicle_number=normalized_plate,
            vehicle_uuid=str(vehicle.uuid) if vehicle else None,
            customer_uuid=str(resolved_customer.uuid) if resolved_customer else None,
            customer_name=resolved_customer.name if resolved_customer else None,
            customer_confidence=customer_conf,
            fuel_type=vehicle_behavior["modal_fuel_type"] if vehicle_behavior else None,
            fuel_type_confidence=fuel_conf,
            rate_per_liter=rate_per_liter,
            payment_mode=suggested_mode,
            payment_mode_confidence=mode_conf,
            vehicle_avg_quantity=avg_qty,
            vehicle_sample_count=sample_count,
            warnings=warnings,
        )
