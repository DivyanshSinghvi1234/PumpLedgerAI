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
            account_number=data.account_number.strip() if data.account_number else None,
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

    def sync_from_entity(
        self,
        db: Session,
        *,
        bank_account_uuid: str | object | None,
        amount: Decimal,
        transaction_type: str,
        transaction_date: date,
        reference_number: str,
        remarks: str,
        pump_id: int | None = None,
    ) -> BankAccount | None:
        """Credit or debit a specific BankAccount (e.g. HDFC vs SBI) from a Payment,
        Voucher, Income, or TankerDelivery and record a traceable BankTransaction."""
        if not bank_account_uuid or amount <= Decimal("0.00"):
            return None
        acc = db.scalars(
            select(BankAccount).where(
                BankAccount.uuid == str(bank_account_uuid),
                BankAccount.is_active.is_(True),
            )
        ).first()
        if acc is None:
            return None
        self.adjust_bank_balance(
            db,
            bank_account_id=acc.id,
            amount=amount,
            transaction_type=transaction_type,
            transaction_date=transaction_date,
            reference_number=reference_number,
            remarks=remarks,
            pump_id=pump_id or acc.pump_id,
        )
        return acc

    def reverse_by_reference(self, db: Session, reference_number: str) -> None:
        """Reverse BankAccount balance and delete BankTransactions matching reference_number."""
        if not reference_number:
            return
        txns = list(
            db.scalars(
                select(BankTransaction).where(
                    BankTransaction.reference_number == reference_number
                )
            ).all()
        )
        for txn in txns:
            if txn.bank_account_id:
                acc = db.get(BankAccount, txn.bank_account_id)
                if acc is not None:
                    if txn.transaction_type in ("INCOME", "DEPOSIT", "TRANSFER_IN"):
                        acc.current_balance = acc.current_balance - txn.amount
                    elif txn.transaction_type in ("EXPENSE", "WITHDRAWAL", "TRANSFER_OUT", "CASH_WITHDRAWAL"):
                        acc.current_balance = acc.current_balance + txn.amount
            db.delete(txn)

    def transfer_between_accounts(
        self,
        db: Session,
        *,
        from_bank_account_uuid: str,
        to_bank_account_uuid: str,
        amount: Decimal,
        transfer_date: date,
        pump_id: int,
        reference_number: str | None = None,
        remarks: str | None = None,
        actor_id: int | None = None,
    ) -> tuple[BankTransaction, BankTransaction]:
        """Transfer funds between two bank accounts (e.g. SBI -> HDFC) without affecting P&L."""
        if from_bank_account_uuid == to_bank_account_uuid:
            raise ValueError("Source and destination bank accounts must be different.")
        if amount <= Decimal("0.00"):
            raise ValueError("Transfer amount must be greater than zero.")

        from_acc = self.get_by_uuid(db, from_bank_account_uuid)
        to_acc = self.get_by_uuid(db, to_bank_account_uuid)

        from_acc.current_balance = from_acc.current_balance - amount
        to_acc.current_balance = to_acc.current_balance + amount

        out_txn = BankTransaction(
            bank_account_id=from_acc.id,
            transaction_type="TRANSFER_OUT",
            amount=amount,
            transaction_date=transfer_date,
            reference_number=reference_number,
            remarks=remarks or f"Transfer to {to_acc.bank_name} ({to_acc.account_name})",
            pump_id=pump_id,
        )
        in_txn = BankTransaction(
            bank_account_id=to_acc.id,
            transaction_type="TRANSFER_IN",
            amount=amount,
            transaction_date=transfer_date,
            reference_number=reference_number,
            remarks=remarks or f"Transfer from {from_acc.bank_name} ({from_acc.account_name})",
            pump_id=pump_id,
        )
        db.add(out_txn)
        db.add(in_txn)
        db.flush()

        self.audit_service.log_action(
            db,
            action="Bank-to-Bank Transfer",
            target_table="bank_accounts",
            target_id=str(from_acc.uuid),
            actor_id=actor_id,
            new_values={
                "from": from_acc.account_name,
                "to": to_acc.account_name,
                "amount": str(amount),
            },
        )
        return out_txn, in_txn

    def withdraw_bank_to_cash(
        self,
        db: Session,
        *,
        bank_account_uuid: str,
        amount: Decimal,
        withdrawal_date: date,
        pump_id: int,
        reference_number: str | None = None,
        remarks: str | None = None,
        actor_id: int | None = None,
    ) -> BankTransaction:
        """Withdraw cash from a bank account into Forecourt Cash-in-Hand without affecting P&L."""
        if amount <= Decimal("0.00"):
            raise ValueError("Withdrawal amount must be greater than zero.")
        acc = self.get_by_uuid(db, bank_account_uuid)
        acc.current_balance = acc.current_balance - amount

        txn = BankTransaction(
            bank_account_id=acc.id,
            transaction_type="CASH_WITHDRAWAL",
            amount=amount,
            transaction_date=withdrawal_date,
            reference_number=reference_number,
            remarks=remarks or f"Cash withdrawn to Forecourt Drawer from {acc.bank_name} ({acc.account_name})",
            pump_id=pump_id,
        )
        db.add(txn)
        db.flush()

        self.audit_service.log_action(
            db,
            action="Withdrew Cash from Bank",
            target_table="bank_accounts",
            target_id=str(acc.uuid),
            actor_id=actor_id,
            new_values={
                "amount": str(amount),
                "new_bank_balance": str(acc.current_balance),
            },
        )
        return txn

    def update_bank_account(
        self,
        db: Session,
        uuid: str,
        data: BankAccountUpdate,
        actor_id: int | None = None,
    ) -> BankAccount:
        acc = self.get_by_uuid(db, uuid)
        for field, val in data.model_dump(exclude_unset=True).items():
            if isinstance(val, str):
                val = val.strip()
            setattr(acc, field, val)
        db.commit()
        db.refresh(acc)
        self.audit_service.log_action(
            db,
            action="Updated Bank Account",
            target_table="bank_accounts",
            target_id=str(acc.uuid),
            actor_id=actor_id,
            new_values={
                "account_name": acc.account_name,
                "bank_name": acc.bank_name,
                "account_type": acc.account_type,
            },
        )
        return acc

    def reconcile_csv(
        self,
        db: Session,
        bank_account_uuid: str,
        csv_text: str,
    ) -> dict:
        """Parse a bank statement CSV and match rows against recorded BankTransactions."""
        import csv
        import io
        from datetime import datetime, timedelta

        acc = self.get_by_uuid(db, bank_account_uuid)
        txns = list(
            db.scalars(
                select(BankTransaction)
                .where(BankTransaction.bank_account_id == acc.id)
                .order_by(BankTransaction.transaction_date.desc())
            ).all()
        )
        used_txn_ids: set[int] = set()

        def _parse_date(raw: str) -> date | None:
            s = (raw or "").strip()
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%Y", "%m/%d/%Y"):
                try:
                    return datetime.strptime(s, fmt).date()
                except ValueError:
                    continue
            return None

        def _parse_num(raw: str | None) -> Decimal:
            if not raw:
                return Decimal("0.00")
            cleaned = raw.replace(",", "").replace("₹", "").strip()
            if not cleaned or cleaned == "-":
                return Decimal("0.00")
            try:
                return abs(Decimal(cleaned)).quantize(Decimal("0.01"))
            except Exception:
                return Decimal("0.00")

        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        matched: list[dict] = []
        unmatched_credits: list[dict] = []
        unmatched_debits: list[dict] = []

        for row in reader:
            norm = {str(k).strip().lower(): (v or "").strip() for k, v in row.items() if k}
            txn_date = _parse_date(
                norm.get("date")
                or norm.get("txn date")
                or norm.get("transaction date")
                or norm.get("value date")
                or ""
            )
            desc = (
                norm.get("description")
                or norm.get("narration")
                or norm.get("particulars")
                or norm.get("remarks")
                or "Bank Entry"
            )
            ref = norm.get("ref") or norm.get("reference") or norm.get("chq/ref no") or norm.get("utr") or ""
            credit_amt = _parse_num(norm.get("credit") or norm.get("deposit") or norm.get("cr"))
            debit_amt = _parse_num(norm.get("debit") or norm.get("withdrawal") or norm.get("dr"))

            if credit_amt <= Decimal("0.00") and debit_amt <= Decimal("0.00"):
                # Fallback if single "amount" + "type" column
                amt = _parse_num(norm.get("amount"))
                t_type = (norm.get("type") or "").upper()
                if "CR" in t_type or "CREDIT" in t_type or "DEP" in t_type:
                    credit_amt = amt
                elif amt > 0:
                    debit_amt = amt

            if credit_amt <= Decimal("0.00") and debit_amt <= Decimal("0.00"):
                continue

            is_credit = credit_amt > Decimal("0.00")
            target_amt = credit_amt if is_credit else debit_amt
            expected_types = {"INCOME", "DEPOSIT", "TRANSFER_IN", "OPENING_BALANCE"} if is_credit else {"EXPENSE", "WITHDRAWAL", "TRANSFER_OUT", "CASH_WITHDRAWAL"}

            match_txn = None
            for t in txns:
                if t.id in used_txn_ids or t.transaction_type not in expected_types:
                    continue
                if abs(t.amount - target_amt) <= Decimal("2.00"):
                    if txn_date is None or abs((t.transaction_date - txn_date).days) <= 3:
                        match_txn = t
                        break

            item = {
                "date": txn_date.isoformat() if txn_date else "",
                "description": desc,
                "reference": ref,
                "amount": float(target_amt),
                "kind": "CREDIT" if is_credit else "DEBIT",
            }
            if match_txn is not None:
                used_txn_ids.add(match_txn.id)
                item["matched_txn_uuid"] = str(match_txn.uuid)
                item["matched_remarks"] = match_txn.remarks
                matched.append(item)
            elif is_credit:
                unmatched_credits.append(item)
            else:
                unmatched_debits.append(item)

        return {
            "bank_account_uuid": str(acc.uuid),
            "account_name": acc.account_name,
            "matched_count": len(matched),
            "unmatched_credits_count": len(unmatched_credits),
            "unmatched_debits_count": len(unmatched_debits),
            "matched": matched,
            "unmatched_credits": unmatched_credits,
            "unmatched_debits": unmatched_debits,
        }

    def reverse_transaction_by_uuid(
        self,
        db: Session,
        txn_uuid: str,
        actor_id: int | None = None,
    ) -> None:
        txn = db.scalar(select(BankTransaction).where(BankTransaction.uuid == txn_uuid))
        if txn is None:
            raise BankAccountNotFoundError(f"Bank transaction '{txn_uuid}' not found.")
        if txn.bank_account_id:
            acc = db.get(BankAccount, txn.bank_account_id)
            if acc is not None:
                if txn.transaction_type in ("INCOME", "DEPOSIT", "TRANSFER_IN"):
                    acc.current_balance = acc.current_balance - txn.amount
                elif txn.transaction_type in ("EXPENSE", "WITHDRAWAL", "TRANSFER_OUT", "CASH_WITHDRAWAL"):
                    acc.current_balance = acc.current_balance + txn.amount
        db.delete(txn)
        db.commit()
        self.audit_service.log_action(
            db,
            action="Reversed Bank Transaction",
            target_table="bank_transactions",
            target_id=txn_uuid,
            actor_id=actor_id,
            old_values={
                "transaction_type": txn.transaction_type,
                "amount": str(txn.amount),
                "remarks": txn.remarks,
            },
        )

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

        cash_withdrawals_from_bank_sum = db.scalar(
            select(func.coalesce(func.sum(BankTransaction.amount), Decimal("0.00")))
            .where(BankTransaction.pump_id == pump_id, BankTransaction.transaction_type == "CASH_WITHDRAWAL")
        ) or Decimal("0.00")

        total_cash_in = cash_vouchers_sum + split_cash_sum + cash_payments_sum + cash_income_sum + cash_withdrawals_from_bank_sum
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
