from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EmployeeCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=100)
    role: str = Field(default="OPERATOR", max_length=50)
    base_salary: Decimal = Field(default=Decimal("0.00"), ge=0)
    commission_rate_per_liter: Decimal = Field(default=Decimal("0.0000"), ge=0)


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=100)
    role: str | None = Field(default=None, max_length=50)
    base_salary: Decimal | None = Field(default=None, ge=0)
    commission_rate_per_liter: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class EmployeeResponse(BaseModel):
    id: int
    uuid: str
    full_name: str
    phone: str | None
    email: str | None
    role: str
    base_salary: Decimal = Decimal("0.00")
    commission_rate_per_liter: Decimal = Decimal("0.0000")
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


StaffLedgerEntryType = Literal[
    "ADVANCE",
    "LOAN",
    "SHORTAGE",
    "COMMISSION",
    "SALARY_PAYMENT",
    "REPAYMENT",
]


class StaffLedgerEntryCreate(BaseModel):
    entry_date: date = Field(default_factory=date.today)
    entry_type: StaffLedgerEntryType
    amount: Decimal = Field(..., gt=0)
    remarks: str | None = Field(default=None, max_length=300)


class StaffLedgerEntryResponse(BaseModel):
    uuid: str
    entry_date: date
    entry_type: str
    amount: Decimal
    signed_amount: Decimal
    remarks: str | None = None
    reference_type: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StaffLedgerSummaryResponse(BaseModel):
    employee_uuid: str
    full_name: str
    role: str
    base_salary: Decimal
    commission_rate_per_liter: Decimal
    outstanding_balance: Decimal
    entries: list[StaffLedgerEntryResponse]


class StaffPayrollRow(BaseModel):
    employee_uuid: str
    full_name: str
    role: str
    base_salary: Decimal
    days_worked: float | None = None
    days_in_month: int | None = None
    prorated_base_salary: Decimal | None = None
    commission_earned: Decimal
    advances_and_loans: Decimal
    shift_shortages: Decimal
    outstanding_balance: Decimal
    net_payable: Decimal
    already_paid_this_month: bool = False


class StaffPayrollPreviewResponse(BaseModel):
    billing_month: str
    total_base_salary: Decimal
    total_commission: Decimal
    total_deductions: Decimal
    total_net_payable: Decimal
    rows: list[StaffPayrollRow]


class StaffPayrollPayRequest(BaseModel):
    billing_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    payment_mode: str = Field(default="CASH")
    bank_account_uuid: UUID | None = None
    commission_override: Decimal | None = Field(default=None, ge=0)
    deduct_outstanding: bool = True
    remarks: str | None = Field(default=None, max_length=300)


class StaffPayrollPayResponse(BaseModel):
    employee_uuid: str
    full_name: str
    billing_month: str
    gross_pay: Decimal
    deducted_amount: Decimal
    net_paid: Decimal
    remaining_balance: Decimal


class StaffBatchPayrollRequest(BaseModel):
    billing_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    payment_mode: str = Field(default="CASH")
    bank_account_uuid: UUID | None = None
    deduct_outstanding: bool = True
    employee_uuids: list[str] | None = None
    remarks: str | None = Field(default=None, max_length=300)


class StaffBatchPayrollResponse(BaseModel):
    billing_month: str
    paid_count: int
    skipped_count: int
    total_net_paid: Decimal
    results: list[StaffPayrollPayResponse]


AttendanceStatus = Literal["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"]


class AttendanceRecordUpsert(BaseModel):
    employee_uuid: str
    attendance_date: date
    status: AttendanceStatus = "PRESENT"
    overtime_hours: Decimal = Field(default=Decimal("0.00"), ge=0, le=24)
    notes: str | None = Field(default=None, max_length=200)


class AttendanceRecordResponse(BaseModel):
    uuid: str
    employee_uuid: str
    employee_name: str
    attendance_date: date
    status: str
    overtime_hours: Decimal
    notes: str | None = None


class AttendanceSyncResponse(BaseModel):
    attendance_date: date
    marked_present_count: int
