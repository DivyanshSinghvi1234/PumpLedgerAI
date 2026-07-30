from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BankAccountBase(BaseModel):
    account_name: str = Field(..., min_length=2, max_length=100)
    bank_name: str = Field(..., min_length=2, max_length=100)
    account_number: Optional[str] = Field(None, max_length=50)
    ifsc_code: Optional[str] = Field(None, max_length=20)
    account_type: str = Field("CURRENT", max_length=30)
    opening_balance: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))



class BankAccountCreate(BankAccountBase):
    pass


class BankAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: Optional[str] = None
    is_active: Optional[bool] = None


class BankAccountResponse(BankAccountBase):
    uuid: str
    current_balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CashDepositRequest(BaseModel):
    bank_account_uuid: str
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    deposit_date: date
    reference_number: Optional[str] = None
    remarks: Optional[str] = None


class BankTransactionResponse(BaseModel):
    uuid: str
    bank_account_uuid: Optional[str] = None
    bank_account_name: Optional[str] = None
    transaction_type: str
    amount: Decimal
    transaction_date: date
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LiquidFundsSummaryResponse(BaseModel):
    total_cash_available: Decimal
    total_bank_balance: Decimal
    total_liquid_funds: Decimal
    accounts: list[BankAccountResponse]
