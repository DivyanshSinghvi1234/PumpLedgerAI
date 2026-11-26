from datetime import date
from decimal import Decimal
from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session


from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.models.pump import Pump
from app.schemas.bank_account import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
    CashDepositRequest,
    BankTransactionResponse,
    LiquidFundsSummaryResponse,
    UpiAccountCreate,
    UpiAccountUpdate,
    UpiAccountResponse,
)
from app.services.bank_account_service import (
    BankAccountService,
    BankAccountNotFoundError,
)

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts"])
service = BankAccountService()

manager_required = [
    Depends(get_current_user),
    Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
]



def _get_active_pump_id(db: Session) -> int:
    from app.database.scoping import active_pump_id
    pid = active_pump_id.get()
    if pid is not None:
        return pid
    p = db.scalars(select(Pump).where(Pump.is_active.is_(True))).first()
    return p.id if p else 1



@router.get(
    "",
    response_model=Sequence[BankAccountResponse],
    dependencies=manager_required,
)
def list_bank_accounts(
    db: Session = Depends(get_db),
):
    pump_id = _get_active_pump_id(db)
    return service.list_bank_accounts(db, pump_id)


@router.get(
    "/summary",
    response_model=LiquidFundsSummaryResponse,
    dependencies=manager_required,
)
def get_liquid_funds_summary(
    db: Session = Depends(get_db),
):
    pump_id = _get_active_pump_id(db)
    return service.get_liquid_funds_summary(db, pump_id)


@router.post(
    "",
    response_model=BankAccountResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager_required,
)
def create_bank_account(
    data: BankAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pump_id = _get_active_pump_id(db)
    return service.create_bank_account(db, data, pump_id, actor_id=current_user.id)


@router.post(
    "/deposit-cash",
    status_code=status.HTTP_200_OK,
    dependencies=manager_required,
)
def deposit_cash_to_bank(
    data: CashDepositRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pump_id = _get_active_pump_id(db)
    try:
        txn = service.deposit_cash_to_bank(db, data, pump_id, actor_id=current_user.id)
        return {"status": "success", "message": f"Successfully deposited ₹{data.amount:,.2f} to bank account.", "transaction_uuid": txn.uuid}
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


class BankTransferRequest(BaseModel):
    from_bank_account_uuid: str
    to_bank_account_uuid: str
    amount: Decimal = Field(..., gt=0)
    transfer_date: date = Field(default_factory=date.today)
    reference_number: str | None = None
    remarks: str | None = None


class BankCashWithdrawalRequest(BaseModel):
    bank_account_uuid: str
    amount: Decimal = Field(..., gt=0)
    withdrawal_date: date = Field(default_factory=date.today)
    reference_number: str | None = None
    remarks: str | None = None


@router.post(
    "/transfer",
    status_code=status.HTTP_200_OK,
    dependencies=manager_required,
)
def transfer_between_banks(
    data: BankTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pump_id = _get_active_pump_id(db)
    try:
        out_txn, in_txn = service.transfer_between_accounts(
            db,
            from_bank_account_uuid=data.from_bank_account_uuid,
            to_bank_account_uuid=data.to_bank_account_uuid,
            amount=data.amount,
            transfer_date=data.transfer_date,
            pump_id=pump_id,
            reference_number=data.reference_number,
            remarks=data.remarks,
            actor_id=current_user.id,
        )
        return {
            "status": "success",
            "message": f"Transferred ₹{data.amount:,.2f} between bank accounts.",
            "out_transaction_uuid": str(out_txn.uuid),
            "in_transaction_uuid": str(in_txn.uuid),
        }
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/withdraw-cash",
    status_code=status.HTTP_200_OK,
    dependencies=manager_required,
)
def withdraw_bank_to_cash(
    data: BankCashWithdrawalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pump_id = _get_active_pump_id(db)
    try:
        txn = service.withdraw_bank_to_cash(
            db,
            bank_account_uuid=data.bank_account_uuid,
            amount=data.amount,
            withdrawal_date=data.withdrawal_date,
            pump_id=pump_id,
            reference_number=data.reference_number,
            remarks=data.remarks,
            actor_id=current_user.id,
        )
        return {
            "status": "success",
            "message": f"Withdrew ₹{data.amount:,.2f} from bank to Forecourt Cash Drawer.",
            "transaction_uuid": str(txn.uuid),
        }
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


class BankReconcileRequest(BaseModel):
    csv_text: str = Field(..., min_length=1)


@router.patch(
    "/{uuid}",
    response_model=BankAccountResponse,
    dependencies=manager_required,
)
def update_bank_account(
    uuid: str,
    data: BankAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_bank_account(db, uuid, data, actor_id=current_user.id)
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/{uuid}/reconcile",
    dependencies=manager_required,
)
def reconcile_bank_statement(
    uuid: str,
    data: BankReconcileRequest,
    db: Session = Depends(get_db),
):
    try:
        return service.reconcile_csv(db, uuid, data.csv_text)
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/transactions",
    dependencies=manager_required,
)
def list_transactions(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    pump_id = _get_active_pump_id(db)
    return service.list_transactions(db, pump_id, limit=limit)


@router.delete(
    "/transactions/{txn_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager_required,
)
def reverse_bank_transaction(
    txn_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.reverse_transaction_by_uuid(db, txn_uuid, actor_id=current_user.id)
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc



@router.get(
    "/upi",
    response_model=Sequence[UpiAccountResponse],
)
def list_upi_accounts(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    pump_id = _get_active_pump_id(db)
    return service.list_upi_accounts(db, pump_id)


@router.post(
    "/upi",
    response_model=UpiAccountResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=manager_required,
)
def create_upi_account(
    data: UpiAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pump_id = _get_active_pump_id(db)
    try:
        return service.create_upi_account(db, data, pump_id, actor_id=current_user.id)
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch(
    "/upi/{upi_uuid}",
    response_model=UpiAccountResponse,
    dependencies=manager_required,
)
def update_upi_account(
    upi_uuid: str,
    data: UpiAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_upi_account(db, upi_uuid, data, actor_id=current_user.id)
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete(
    "/upi/{upi_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager_required,
)
def delete_upi_account(
    upi_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_upi_account(db, upi_uuid, actor_id=current_user.id)
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=manager_required,
)
def deactivate_bank_account(
    uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        account = service.get_by_uuid(db, uuid)
        account.is_active = False
        db.flush()
    except BankAccountNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
