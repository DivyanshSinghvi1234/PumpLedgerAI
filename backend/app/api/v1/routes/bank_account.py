from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session


from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.models.pump import Pump
from app.schemas.bank_account import (
    BankAccountCreate,
    BankAccountResponse,
    CashDepositRequest,
    BankTransactionResponse,
    LiquidFundsSummaryResponse,
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
