from decimal import Decimal
from pydantic import BaseModel, Field

from app.core.enums import FuelType, PaymentMode


class OCRExtractionItem(BaseModel):
    fuel_type: FuelType = Field(
        description="Fuel type: PETROL, SPEED, DIESEL, or LUBRICANT only."
    )
    quantity_liters: Decimal = Field(
        description="Quantity in liters/units. Handle stacked decimals."
    )
    rate_per_liter: Decimal = Field(
        description="Rate per liter/unit in INR. Handle stacked decimals."
    )
    total_amount: Decimal = Field(
        description="Total amount in INR for this product line item. Must equal quantity * rate."
    )


class OCRExtraction(BaseModel):
    invoice_number: str | None = Field(
        default=None, 
        description="Invoice/bill number (e.g., HP/DEL/2024/001234). Return null if not visible."
    )
    invoice_date: str | None = Field(
        default=None, 
        description="Invoice date in YYYY-MM-DD format only. Return null if not visible."
    )

    customer_name: str | None = Field(
        default=None, 
        description="Customer name. If Hindi/Devanagari, transliterate to English (e.g., 'राम' → 'Ram')."
    )
    vehicle_number: str | None = Field(
        default=None, 
        description="Vehicle registration number (uppercase, no spaces, e.g., 'DL01AB1234')."
    )

    total_amount: Decimal | None = Field(
        default=None, 
        description="Grand total amount in INR for the entire bill. Must equal the sum of all item amounts (±₹1)."
    )

    payment_mode: PaymentMode | None = Field(
        default=None, 
        description="Payment mode: CASH, UPI, CARD, or CREDIT only."
    )

    remarks: str | None = Field(
        default=None, 
        description="Any remarks/notes. Transliterate Hindi to English."
    )

    confidence: float = Field(
        default=0.0, 
        ge=0.0, 
        le=1.0,
        description="Overall extraction confidence 0.0-1.0. 1.0 = certain, 0.5 = unsure, 0.0 = not found."
    )

    items: list[OCRExtractionItem] = Field(
        default_factory=list,
        description="List of individual items/products scanned from the bill. Can be empty if no items found."
    )