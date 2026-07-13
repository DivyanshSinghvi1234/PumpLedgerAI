from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


class DashboardResponse(BaseModel):

    today_sales: Decimal

    today_vouchers: int

    petrol_sales: Decimal

    diesel_sales: Decimal

    cash_sales: Decimal

    upi_sales: Decimal

    credit_sales: Decimal

    average_invoice: Decimal