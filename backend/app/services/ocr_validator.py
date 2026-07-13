from __future__ import annotations

from decimal import Decimal

from app.schemas.vision import OCRResult


class OCRValidator:

    @staticmethod
    def validate(
        result: OCRResult,
    ) -> list[str]:

        errors = []

        if not result.invoice_number:
            errors.append(
                "Invoice number is missing."
            )

        if result.quantity_liters <= 0:
            errors.append(
                "Quantity must be greater than zero."
            )

        if result.rate_per_liter <= 0:
            errors.append(
                "Rate must be greater than zero."
            )

        if result.total_amount <= 0:
            errors.append(
                "Total amount must be greater than zero."
            )

        expected = (
            result.quantity_liters
            * result.rate_per_liter
        ).quantize(
            Decimal("0.01")
        )

        difference = abs(
            expected - result.total_amount
        )

        if difference > Decimal("1.00"):
            errors.append(
                "Total amount does not match quantity × rate."
            )

        return errors