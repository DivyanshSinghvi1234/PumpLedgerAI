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

        if not ocr.fuel_type:
            errors.append(
                "Fuel type missing."
            )

        if ocr.quantity_liters <= Decimal("0"):
            errors.append(
                "Quantity must be greater than zero."
            )

        if ocr.rate_per_liter <= Decimal("0"):
            errors.append(
                "Rate must be greater than zero."
            )

        calculated_total = (
            ocr.quantity_liters
            * ocr.rate_per_liter
        )

        if abs(
            calculated_total - ocr.total_amount
        ) > Decimal("2.00"):
            warnings.append(
                "Calculated total differs from OCR total."
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