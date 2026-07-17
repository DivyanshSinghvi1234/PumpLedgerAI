from __future__ import annotations

from decimal import Decimal

from app.schemas.review import (
    ReviewResponse,
    ValidationResult,
)
from app.schemas.vision import OCRResult


class OCRReviewService:

    def review(
        self,
        ocr: OCRResult,
    ) -> ReviewResponse:

        warnings: list[str] = []

        errors: list[str] = []

        if not ocr.invoice_number:
            warnings.append(
                "Invoice number missing."
            )

        if ocr.items:
            for i, item in enumerate(ocr.items):
                if not item.fuel_type:
                    errors.append(f"Fuel type missing for item {i + 1}.")
                if item.quantity_liters <= Decimal("0"):
                    errors.append(f"Quantity must be greater than zero for item {i + 1}.")
                if item.rate_per_liter <= Decimal("0"):
                    errors.append(f"Rate must be greater than zero for item {i + 1}.")
        else:
            if not ocr.fuel_type:
                errors.append("Fuel type missing.")
            
            qty = ocr.quantity_liters if ocr.quantity_liters is not None else Decimal("0")
            rate = ocr.rate_per_liter if ocr.rate_per_liter is not None else Decimal("0")
            
            if qty <= Decimal("0"):
                errors.append("Quantity must be greater than zero.")
            if rate <= Decimal("0"):
                errors.append("Rate must be greater than zero.")
            
        calculated_total = (
            sum(item.total_amount for item in ocr.items)
            if ocr.items
            else (ocr.quantity_liters or Decimal("0")) * (ocr.rate_per_liter or Decimal("0"))
        )

        if abs(
            calculated_total - ocr.total_amount
        ) > Decimal("2.00"):
            warnings.append(
                "Calculated total differs from invoice total."
            )

        if ocr.confidence < 0.85:
            warnings.append(
                f"Low OCR confidence ({ocr.confidence * 100:.0f}%). Please verify fields manually."
            )

        return ReviewResponse(
            ocr=ocr,
            validation=ValidationResult(
                warnings=warnings,
                errors=errors,
            ),
            ready_to_save=len(errors) == 0 and ocr.confidence >= 0.85,
        )