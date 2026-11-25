from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import IncomeKind
from app.core.exceptions import AppException
from app.models.recurring_expense import RecurringExpense
from app.schemas.income import IncomeCreate
from app.schemas.recurring_expense import (
    RecurringExpenseBatchPostResponse,
    RecurringExpenseCreate,
    RecurringExpensePostResult,
    RecurringExpenseUpdate,
)
from app.services.audit_log_service import AuditLogService
from app.services.income_service import IncomeService


class RecurringExpenseNotFoundError(AppException):
    def __init__(self, identifier: str) -> None:
        super().__init__(f"Recurring expense '{identifier}' not found.")


class RecurringExpenseService:
    """Manages recurring expense templates and one-click posting into the expense register."""

    def __init__(self) -> None:
        self.income_service = IncomeService()
        self.audit_service = AuditLogService()

    def list_all(self, db: Session) -> list[RecurringExpense]:
        return list(
            db.scalars(
                select(RecurringExpense)
                .where(RecurringExpense.is_active.is_(True))
                .order_by(RecurringExpense.next_due_date.asc(), RecurringExpense.title.asc())
            ).all()
        )

    def list_due(self, db: Session, as_of: date | None = None) -> list[RecurringExpense]:
        cutoff = as_of or date.today()
        return list(
            db.scalars(
                select(RecurringExpense)
                .where(
                    RecurringExpense.is_active.is_(True),
                    RecurringExpense.next_due_date <= cutoff,
                )
                .order_by(RecurringExpense.next_due_date.asc(), RecurringExpense.title.asc())
            ).all()
        )

    def get_by_uuid(self, db: Session, uuid_str: str) -> RecurringExpense:
        row = db.scalar(
            select(RecurringExpense).where(
                RecurringExpense.uuid == uuid_str,
                RecurringExpense.is_active.is_(True),
            )
        )
        if row is None:
            raise RecurringExpenseNotFoundError(uuid_str)
        return row

    def create(
        self,
        db: Session,
        data: RecurringExpenseCreate,
        actor_id: int | None = None,
    ) -> RecurringExpense:
        due_day = data.due_day
        if due_day is None and data.frequency == "MONTHLY":
            due_day = data.next_due_date.day
        elif due_day is None and data.frequency == "WEEKLY":
            due_day = data.next_due_date.weekday()

        row = RecurringExpense(
            title=data.title.strip(),
            category=data.category.strip(),
            amount=data.amount,
            frequency=data.frequency,
            due_day=due_day,
            payment_mode=data.payment_mode,
            bank_account_uuid=data.bank_account_uuid,
            next_due_date=data.next_due_date,
            notes=data.notes.strip() if data.notes else None,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        self.audit_service.log_action(
            db,
            action="Created Recurring Expense",
            target_table="recurring_expenses",
            target_id=str(row.id),
            actor_id=actor_id,
            new_values={
                "title": row.title,
                "amount": str(row.amount),
                "frequency": row.frequency,
                "next_due_date": row.next_due_date.isoformat(),
            },
        )
        return row

    def update(
        self,
        db: Session,
        uuid_str: str,
        data: RecurringExpenseUpdate,
        actor_id: int | None = None,
    ) -> RecurringExpense:
        row = self.get_by_uuid(db, uuid_str)
        for field, val in data.model_dump(exclude_unset=True).items():
            if isinstance(val, str) and field in {"title", "category", "notes"}:
                val = val.strip()
            setattr(row, field, val)
        db.commit()
        db.refresh(row)
        self.audit_service.log_action(
            db,
            action="Updated Recurring Expense",
            target_table="recurring_expenses",
            target_id=str(row.id),
            actor_id=actor_id,
        )
        return row

    def delete(self, db: Session, uuid_str: str, actor_id: int | None = None) -> None:
        row = self.get_by_uuid(db, uuid_str)
        row.is_active = False
        db.commit()
        self.audit_service.log_action(
            db,
            action="Deleted Recurring Expense",
            target_table="recurring_expenses",
            target_id=str(row.id),
            actor_id=actor_id,
        )

    @staticmethod
    def _advance_due_date(current_due: date, frequency: str, due_day: int | None) -> date:
        if frequency == "DAILY":
            return current_due + timedelta(days=1)
        if frequency == "WEEKLY":
            return current_due + timedelta(days=7)
        # MONTHLY: advance 1 month and clamp to valid day of target month
        year = current_due.year + (1 if current_due.month == 12 else 0)
        month = 1 if current_due.month == 12 else current_due.month + 1
        target_day = due_day if (due_day and 1 <= due_day <= 31) else current_due.day
        _, max_day = monthrange(year, month)
        return date(year, month, min(target_day, max_day))

    def post_due(
        self,
        db: Session,
        uuid_str: str,
        *,
        post_date: date | None = None,
        amount_override: Decimal | None = None,
        actor_id: int | None = None,
    ) -> RecurringExpensePostResult:
        row = self.get_by_uuid(db, uuid_str)
        effective_date = post_date or date.today()
        effective_amount = (amount_override if amount_override is not None else row.amount).quantize(
            Decimal("0.01")
        )

        bank_uuid = UUID(row.bank_account_uuid) if row.bank_account_uuid else None
        income_req = IncomeCreate(
            income_date=effective_date,
            kind=IncomeKind.EXPENSE,
            description=f"{row.title} (Recurring)",
            amount=effective_amount,
            category=row.category,
            payment_mode=row.payment_mode,
            bank_account_uuid=bank_uuid,
        )
        income = self.income_service.create(db, income_req, actor_id=actor_id)

        row.last_posted_date = effective_date
        row.next_due_date = self._advance_due_date(row.next_due_date, row.frequency, row.due_day)
        db.commit()
        db.refresh(row)

        return RecurringExpensePostResult(
            recurring_uuid=UUID(str(row.uuid)),
            title=row.title,
            posted_amount=effective_amount,
            posted_date=effective_date,
            next_due_date=row.next_due_date,
            income_uuid=UUID(str(income.uuid)),
        )

    def post_all_due(
        self,
        db: Session,
        *,
        as_of: date | None = None,
        actor_id: int | None = None,
    ) -> RecurringExpenseBatchPostResponse:
        effective_date = as_of or date.today()
        due_rows = self.list_due(db, as_of=effective_date)
        results: list[RecurringExpensePostResult] = []
        total = Decimal("0.00")

        for row in due_rows:
            res = self.post_due(db, str(row.uuid), post_date=effective_date, actor_id=actor_id)
            results.append(res)
            total += res.posted_amount

        return RecurringExpenseBatchPostResponse(
            posted_count=len(results),
            total_amount=total.quantize(Decimal("0.01")),
            items=results,
        )
