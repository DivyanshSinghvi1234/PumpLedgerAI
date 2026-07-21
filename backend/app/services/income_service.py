from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import FuelType, IncomeKind, LedgerEntryType
from app.core.exceptions import IncomeNotFoundError
from app.models.income import Income
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.payment import Payment
from app.repositories.customer_repository import CustomerRepository
from app.repositories.income_repository import IncomeRepository
from app.schemas.income import (
    FuelSaleRow,
    IncomeCreate,
    IncomeSummaryResponse,
)
from app.services.audit_log_service import AuditLogService
from app.services.ledger_service import LedgerService
from app.services.price_schedule_service import PriceScheduleService


class IncomeService:

    def __init__(self) -> None:
        self.repository = IncomeRepository()
        self.customer_repository = CustomerRepository()
        self.ledger_service = LedgerService()
        self.audit_service = AuditLogService()
        self.price_service = PriceScheduleService()

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: IncomeCreate,
        actor_id: int | None = None,
    ) -> Income:

        # An expense may be linked to a customer — this is a loan: the amount
        # lent is posted as a debit to that customer's ledger so it shows up
        # as an outstanding balance (they owe us). Income rows are never
        # linked, since money coming in isn't a receivable.
        # Resolve by explicit uuid (must exist) or by name (links to an
        # existing customer, else auto-creates one). Raises
        # CustomerNotFoundError only when a uuid is given but not found.
        customer = self.customer_repository.resolve_or_create_customer(
            db,
            data.customer_uuid,
            data.customer_name,
        )

        income = Income(
            kind=data.kind,
            income_date=data.income_date,
            description=data.description.strip(),
            amount=data.amount,
            category=(data.category.strip() or None) if data.category else None,
            payment_mode=data.payment_mode,
            customer_id=customer.id if customer else None,
        )

        if customer is not None:
            # Flush to assign income.id so the ledger entry can reference it,
            # then let the ledger service commit the row + balance atomically
            # (the ledger is the single balance writer). A loan is a debit —
            # DEBIT_ADJUSTMENT increases what the customer owes.
            db.add(income)
            db.flush()

            self.ledger_service.post(
                db,
                customer,
                LedgerEntryType.DEBIT_ADJUSTMENT,
                data.amount,
                entry_date=data.income_date,
                reference_type="INCOME",
                reference_id=income.id,
                remarks=f"Loan — {income.description}",
                extra_objects=[income],
                actor_id=actor_id,
            )
        else:
            income = self.repository.create(db, income)

        self.audit_service.log_action(
            db,
            action="Recorded Deposit" if data.kind == IncomeKind.DEPOSIT else "Recorded Expense" if data.kind == IncomeKind.EXPENSE else "Recorded Income",
            target_table="incomes",
            target_id=str(income.id),
            actor_id=actor_id,
            new_values={
                "kind": data.kind.value,
                "income_date": str(data.income_date),
                "description": income.description,
                "amount": str(data.amount),
                "category": income.category,
                "payment_mode": data.payment_mode.value,
                "customer_id": str(customer.id) if customer else None,
            },
        )

        return income

    # -----------------------------------
    # Search
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        income_date: date | None = None,
        kind: IncomeKind | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Income], int]:

        return self.repository.search(
            db,
            income_date=income_date,
            kind=kind,
            search=search,
            page=page,
            page_size=page_size,
        )

    # -----------------------------------
    # Categories (for the frontend datalist)
    # -----------------------------------

    def list_categories(self, db: Session) -> list[str]:
        return self.repository.distinct_categories(db)

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        income_uuid: str,
        actor_id: int | None = None,
    ) -> None:

        income = self.repository.get_by_uuid(db, income_uuid)

        if income is None:
            raise IncomeNotFoundError(income_uuid)

        old_values = {
            "kind": income.kind.value,
            "income_date": str(income.income_date),
            "description": income.description,
            "amount": str(income.amount),
            "category": income.category,
            "payment_mode": income.payment_mode.value,
            "customer_id": str(income.customer_id) if income.customer_id else None,
        }

        if income.customer is not None:
            # Reversing the ledger entry restores the customer's balance and
            # deletes the income row in one transaction (mirrors payment delete).
            self.ledger_service.reverse_reference(
                db,
                income.customer,
                "INCOME",
                income.id,
                extra_deletes=[income],
                actor_id=actor_id,
            )
        else:
            self.repository.delete(db, income)

        self.audit_service.log_action(
            db,
            action="Deleted Deposit" if income.kind == IncomeKind.DEPOSIT else "Deleted Expense" if income.kind == IncomeKind.EXPENSE else "Deleted Income",
            target_table="incomes",
            target_id=str(income.id),
            actor_id=actor_id,
            old_values=old_values,
        )


    # -----------------------------------
    # Update
    # -----------------------------------

    def update(
        self,
        db: Session,
        income_uuid: str,
        data: IncomeCreate,
        actor_id: int | None = None,
    ) -> Income:
        income = self.repository.get_by_uuid(db, income_uuid)
        if income is None:
            raise IncomeNotFoundError(income_uuid)

        # Reversing old ledger entry if customer was linked
        if income.customer is not None:
            self.ledger_service.reverse_reference(
                db,
                income.customer,
                "INCOME",
                income.id,
                extra_deletes=[],
                actor_id=actor_id,
            )
            # Clear link locally so we can resolve a new one
            income.customer_id = None
            income.customer = None
            db.flush()

        customer = self.customer_repository.resolve_or_create_customer(
            db,
            data.customer_uuid,
            data.customer_name,
        )

        income.kind = data.kind
        income.income_date = data.income_date
        income.description = data.description.strip()
        income.amount = data.amount
        income.category = (data.category.strip() or None) if data.category else None
        income.payment_mode = data.payment_mode
        income.customer_id = customer.id if customer else None

        if customer is not None:
            db.flush()
            self.ledger_service.post(
                db,
                customer,
                LedgerEntryType.DEBIT_ADJUSTMENT,
                data.amount,
                entry_date=data.income_date,
                reference_type="INCOME",
                reference_id=income.id,
                remarks=f"Loan — {income.description}",
                extra_objects=[],
                actor_id=actor_id,
            )
        else:
            db.add(income)
            db.flush()

        self.audit_service.log_action(
            db,
            action="Updated Deposit" if data.kind == IncomeKind.DEPOSIT else "Updated Expense" if data.kind == IncomeKind.EXPENSE else "Updated Income",
            target_table="incomes",
            target_id=str(income.id),
            actor_id=actor_id,
            new_values={
                "kind": data.kind.value,
                "income_date": str(data.income_date),
                "description": income.description,
                "amount": str(data.amount),
                "category": income.category,
                "payment_mode": data.payment_mode.value,
                "customer_id": str(customer.id) if customer else None,
            },
        )

        return income

    # -----------------------------------
    # Daily summary
    # -----------------------------------

    def daily_summary(
        self,
        db: Session,
        *,
        on_date: date,
    ) -> IncomeSummaryResponse:
        """Per-fuel-type sales (aggregated liters × active rate) plus the
        headline totals for the day."""

        # Aggregate net liters sold per fuel type from the day's nozzle
        # readings. total_sales includes testing, so we subtract testing_liters
        # to get actual customer-facing sales volume.
        rows = db.execute(
            select(
                Nozzle.fuel_type,
                func.coalesce(func.sum(NozzleReading.total_sales), 0.0),
                func.coalesce(func.sum(NozzleReading.testing_liters), 0.0),
            )
            .join(Nozzle, NozzleReading.nozzle_id == Nozzle.id)
            .where(NozzleReading.reading_date == on_date)
            .group_by(Nozzle.fuel_type)
        ).all()

        # Resolve the active rate for each fuel type as of end-of-day, so the
        # displayed rate matches what was in effect for that day's sales.
        at_time = datetime.combine(on_date, time.max, tzinfo=timezone.utc)

        fuel_sales: list[FuelSaleRow] = []
        total_sales = Decimal("0.00")

        for fuel_type, liters_raw, testing_raw in rows:
            gross_liters = Decimal(str(liters_raw or 0))
            testing_liters = Decimal(str(testing_raw or 0))
            # Net liters = total meter qty minus nozzle testing
            liters = (gross_liters - testing_liters).quantize(Decimal("0.001"))
            if liters <= 0:
                continue

            rate = self.price_service.get_active_rate(
                db, fuel_type, at_time
            ) or Decimal("0.00")
            rate = Decimal(str(rate))

            amount = (liters * rate).quantize(Decimal("0.01"))
            total_sales += amount

            fuel_sales.append(
                FuelSaleRow(
                    fuel_type=fuel_type,
                    liters=liters,
                    rate=rate,
                    amount=amount,
                )
            )

        totals = self.repository.totals_for_date(db, on_date)
        total_incomes = Decimal(
            str(totals.get(IncomeKind.INCOME, 0))
        ).quantize(Decimal("0.01"))
        total_expenses = Decimal(
            str(totals.get(IncomeKind.EXPENSE, 0))
        ).quantize(Decimal("0.01"))
        total_deposits = Decimal(
            str(totals.get(IncomeKind.DEPOSIT, 0))
        ).quantize(Decimal("0.01"))

        # Sum of all customer payments received on this date (money coming in
        # from credit customers settling their outstanding balances).
        total_payments = Decimal(
            str(
                db.scalar(
                    select(func.coalesce(func.sum(Payment.amount), 0))
                    .where(Payment.payment_date == on_date)
                    .where(Payment.is_active == True)
                )
                or 0
            )
        ).quantize(Decimal("0.01"))

        # Cash actually in hand = fuel sales + other income + payments received,
        # less money paid out (expenses and deposits).
        cash_in_hand = (
            total_sales + total_incomes + total_payments - total_expenses - total_deposits
        ).quantize(Decimal("0.01"))

        return IncomeSummaryResponse(
            summary_date=on_date,
            fuel_sales=fuel_sales,
            total_sales=total_sales.quantize(Decimal("0.01")),
            total_incomes=total_incomes,
            total_expenses=total_expenses,
            total_deposits=total_deposits,
            total_payments=total_payments,
            cash_in_hand=cash_in_hand,
        )
