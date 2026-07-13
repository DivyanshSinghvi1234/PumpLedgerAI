from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from app.core.enums import (
    AIProvider,
    FuelType,
    PaymentMode,
)


class OCRResult(BaseModel):
    provider: AIProvider

    confidence: float = 1.0

    invoice_number: str | None = None

    invoice_date: str | None = None

    customer_name: str | None = None

    vehicle_number: str | None = None

    fuel_type: FuelType | None = None

    quantity_liters: Decimal = Decimal("0")

    rate_per_liter: Decimal = Decimal("0")

    total_amount: Decimal = Decimal("0")

    payment_mode: PaymentMode | None = None

    remarks: str | None = None

    image_path: str