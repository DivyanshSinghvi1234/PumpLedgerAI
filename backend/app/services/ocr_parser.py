from __future__ import annotations

from decimal import Decimal

from app.core.enums import AIProvider
from app.schemas.ocr import OCRExtraction
from app.schemas.vision import OCRResult, OCRResultItem
from app.utils.date_parser import normalize_date


def _to_decimal(value: Decimal | float | str | None) -> Decimal:
    """Coerce an extracted numeric value to Decimal, defaulting to 0."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


class OCRParser:

    @staticmethod
    def parse(
        extraction: OCRExtraction,
        image_path: str,
    ) -> OCRResult:

        parsed_items = []
        for item in (extraction.items or []):
            parsed_items.append(
                OCRResultItem(
                    fuel_type=item.fuel_type,
                    quantity_liters=_to_decimal(item.quantity_liters),
                    rate_per_liter=_to_decimal(item.rate_per_liter),
                    total_amount=_to_decimal(item.total_amount),
                )
            )

        return OCRResult(
            provider=AIProvider.GEMINI,
            confidence=(
                extraction.confidence
                if extraction.confidence is not None
                else 1.0
            ),

            invoice_number=(
                extraction.invoice_number.strip()
                if extraction.invoice_number
                else None
            ),

            invoice_date=normalize_date(
                extraction.invoice_date
            ),

            customer_name=(
                extraction.customer_name.strip()
                if extraction.customer_name
                else None
            ),

            vehicle_number=(
                extraction.vehicle_number.strip().upper()
                if extraction.vehicle_number
                else None
            ),

            fuel_type=None,
            quantity_liters=None,
            rate_per_liter=None,

            total_amount=_to_decimal(
                extraction.total_amount
            ),

            payment_mode=extraction.payment_mode,

            remarks=(
                extraction.remarks.strip()
                if extraction.remarks
                else None
            ),

            image_path=image_path,
            items=parsed_items,
        )