from decimal import Decimal

from pydantic import BaseModel

from app.core.enums import FuelType, PaymentMode


class OCRExtraction(BaseModel):
    invoice_number: str | None = None
    invoice_date: str | None = None

    customer_name: str | None = None
    vehicle_number: str | None = None

    fuel_type: FuelType | None = None

    quantity_liters: Decimal | None = None
    rate_per_liter: Decimal | None = None
    total_amount: Decimal | None = None

    payment_mode: PaymentMode | None = None

    remarks: str | None = None

    confidence: float | None = None