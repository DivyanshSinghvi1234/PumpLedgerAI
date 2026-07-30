from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Sequence

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount, BankTransaction
from app.models.voucher import Voucher
from app.models.payment import Payment
from app.models.income import Income
from app.schemas.bank_account import (
    BankAccountCreate,
    BankAccountUpdate,
    CashDepositRequest,
)
from app.services.audit_log_service import AuditLogService
from app.core.enums import IncomeKind, PaymentMode


class BankAccountNotFoundError(Exception):
    pass


class BankAccountService:

    def __init__(self):
        self.audit_service = AuditLogService()

    def get_by_uuid(self, db: Session, uuid: str) -> BankAccount:
        account = db.scalars(
            select(BankAccount).where(BankAccount.uuid == uuid)
        ).first()
        if not account:
            raise BankAccountNotFoundError(f"Bank Account with UUID '{uuid}' not found.")
        return account

    def create_bank_account(
        self,
        db: Session,
        data: BankAccountCreate,
        pump_id: int,
        actor_id: int | None = None,
    ) -> BankAccount:
        account = BankAccount(
            account_name=data.account_name.strip(),
            bank_name=data.bank_name.strip(),
            account_number=data.account_number.strip(),
            ifsc_code=data.ifsc_code.strip() if data.ifsc_code else None,
            account_type=data.account_type,
            opening_balance=data.opening_balance,
            current_balance=data.opening_balance,
            pump_id=pump_id,
        )
        db.add(account)
        db.flush()

        if data.opening_balance > Decimal("0.00"):
            txn = BankTransaction(
                bank_account_id=account.id,
                transaction_type="OPENING_BALANCE",
                amount=data.opening_balance,
                transaction_date=date.today(),
                remarks="Initial Bank Account Opening Balance",
                pump_id=pump_id,
            )
            db.add(txn)

        self.audit_service.log_action(
            db,
            action="Created Bank Account",
            target_table="bank_accounts",
            target_id=str(account.uuid),
            actor_id=actor_id,
            new_values={
                "bank_name": account.bank_name,
                "account_number": account.account_number,
                "opening_balance": str(account.opening_balance),
            },
        )
        return account

    def list_bank_accounts(self, db: Session, pump_id: int) -> Sequence[BankAccount]:
        return db.scalars(
            select(BankAccount)
            .where(BankAccount.pump_id == pump_id, BankAccount.is_active.is_(True))
            .order_by(BankAccount.bank_name, BankAccount.account_name)
        ).all()

    def deposit_cash_to_bank(
        self,
        db: Session,
        data: CashDepositRequest,
        pump_id: int,
        actor_id: int | None = None,
    ) -> BankTransaction:
        account = self.get_by_uuid(db, data.bank_account_uuid)

        # Increase bank balance
        account.current_balance = account.current_balance + data.amount

        # Record Bank Transaction
        txn = BankTransaction(
            bank_account_id=account.id,
            transaction_type="DEPOSIT",
            amount=data.amount,
            transaction_date=data.deposit_date,
            reference_number=data.reference_number,
            remarks=data.remarks or f"Cash deposit into {account.bank_name} ({account.account_name})",
            pump_id=pump_id,
        )
        db.add(txn)
        db.flush()

        self.audit_service.log_action(
            db,
            action="Deposited Cash to Bank Account",
            target_table="bank_accounts",
            target_id=str(account.uuid),
            actor_id=actor_id,
            new_values={
                "amount": str(data.amount),
                "new_bank_balance": str(account.current_balance),
                "reference_number": data.reference_number,
            },
        )

        return txn

    def adjust_bank_balance(
        self,
        db: Session,
        bank_account_id: int,
        amount: Decimal,
        transaction_type: str,
        transaction_date: date,
        reference_number: str | None = None,
        remarks: str | None = None,
        pump_id: int | None = None,
    ) -> BankTransaction:
        account = db.get(BankAccount, bank_account_id)
        if not account:
            raise BankAccountNotFoundError(f"Bank Account with ID {bank_account_id} not found.")

        if transaction_type in ("INCOME", "DEPOSIT"):
            account.current_balance = account.current_balance + amount
        elif transaction_type in ("EXPENSE", "WITHDRAWAL"):
            account.current_balance = account.current_balance - amount

        txn = BankTransaction(
            bank_account_id=account.id,
            transaction_type=transaction_type,
            amount=amount,
            transaction_date=transaction_date,
            reference_number=reference_number,
            remarks=remarks,
            pump_id=pump_id or account.pump_id,
        )
        db.add(txn)
        db.flush()
        return txn

    def get_liquid_funds_summary(self, db: Session, pump_id: int) -> dict:
        accounts = self.list_bank_accounts(db, pump_id)
        total_bank_balance = sum((a.current_balance for a in accounts), Decimal("0.00"))

        # Calculate Total Cash Available from Vouchers, Payments, Incomes, and Bank Deposits
        cash_vouchers_sum = db.scalar(
            select(func.coalesce(func.sum(Voucher.total_amount), Decimal("0.00")))
            .where(Voucher.pump_id == pump_id, Voucher.payment_mode == PaymentMode.CASH, Voucher.is_active.is_(True))
        ) or Decimal("0.00")

        split_cash_sum = db.scalar(
            select(func.coalesce(func.sum(Voucher.cash_amount), Decimal("0.00")))
            .where(Voucher.pump_id == pump_id, Voucher.payment_mode == PaymentMode.SPLIT, Voucher.is_active.is_(True))
        ) or Decimal("0.00")

        cash_payments_sum = db.scalar(
            select(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
            .where(Payment.pump_id == pump_id, Payment.payment_mode == PaymentMode.CASH, Payment.is_active.is_(True))
        ) or Decimal("0.00")

        cash_income_sum = db.scalar(
            select(func.coalesce(func.sum(Income.amount), Decimal("0.00")))
            .where(Income.pump_id == pump_id, Income.payment_mode == PaymentMode.CASH, Income.kind == IncomeKind.INCOME, Income.is_active.is_(True))
        ) or Decimal("0.00")

        cash_expenses_sum = db.scalar(
            select(func.coalesce(func.sum(Income.amount), Decimal("0.00")))
            .where(Income.pump_id == pump_id, Income.payment_mode == PaymentMode.CASH, Income.kind == IncomeKind.EXPENSE, Income.is_active.is_(True))
        ) or Decimal("0.00")

        cash_deposits_to_bank_sum = db.scalar(
            select(func.coalesce(func.sum(BankTransaction.amount), Decimal("0.00")))
            .where(BankTransaction.pump_id == pump_id, BankTransaction.transaction_type == "DEPOSIT")
        ) or Decimal("0.00")

        total_cash_in = cash_vouchers_sum + split_cash_sum + cash_payments_sum + cash_income_sum
        total_cash_out = cash_expenses_sum + cash_deposits_to_bank_sum

        total_cash_available = total_cash_in - total_cash_out
        if total_cash_available < Decimal("0.00"):
            total_cash_available = Decimal("0.00")

        total_liquid_funds = total_cash_available + total_bank_balance

        return {
            "total_cash_available": total_cash_available,
            "total_bank_balance": total_bank_balance,
            "total_liquid_funds": total_liquid_funds,
            "accounts": accounts,
        }

    def list_transactions(self, db: Session, pump_id: int, limit: int = 50) -> list[dict]:
        txns = db.scalars(
            select(BankTransaction)
            .where(BankTransaction.pump_id == pump_id)
            .order_by(BankTransaction.transaction_date.desc(), BankTransaction.id.desc())
            .limit(limit)
        ).all()

        res = []
        for t in txns:
            account_name = t.bank_account.bank_name + " (" + t.bank_account.account_name + ")" if t.bank_account else "Forecourt Cash Drawer"
            res.append({
                "uuid": t.uuid,
                "bank_account_uuid": t.bank_account.uuid if t.bank_account else None,
                "bank_account_name": account_name,
                "transaction_type": t.transaction_type,
                "amount": t.amount,
                "transaction_date": t.transaction_date,
                "reference_number": t.reference_number,
                "remarks": t.remarks,
                "created_at": t.created_at,
            })
        return res
