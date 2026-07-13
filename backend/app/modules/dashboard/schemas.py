from pydantic import BaseModel

from app.schemas.voucher import VoucherResponse


class DashboardSummary(BaseModel):
    today_sales: float

    total_sales: float

    today_vouchers: int

    total_vouchers: int

    total_customers: int

    total_vehicles: int

    pending_review: int

    verified: int


class FuelDistribution(BaseModel):
    petrol: int

    diesel: int

    lubricant: int


class DashboardResponse(BaseModel):
    summary: DashboardSummary

    fuel_distribution: FuelDistribution

    recent_vouchers: list[VoucherResponse]