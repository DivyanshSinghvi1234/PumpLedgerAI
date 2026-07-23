from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import FuelType, IncomeKind, LedgerEntryType, PaymentMode
from app.core.exceptions import IncomeNotFoundError
from app.models.income import Income
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.payment import Payment
from app.models.voucher import Voucher
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

        # Calculate amount mismatch if fuel details/items were provided
        expected_sum = Decimal("0.00")
        has_calc = False

        if data.items and len(data.items) > 0:
            for item in data.items:
                if item.quantity_liters is not None and item.rate_per_liter is not None:
                    expected_sum += (item.quantity_liters * item.rate_per_liter)
                    has_calc = True
        elif data.quantity_liters is not None and data.rate_per_liter is not None:
            expected_sum = data.quantity_liters * data.rate_per_liter
            has_calc = True

        is_mismatch = False
        if has_calc:
            is_mismatch = abs(expected_sum - data.amount) > Decimal("1.00")

        items_dict = [i.model_dump(mode="json") for i in data.items] if data.items else None

        income = Income(
            kind=data.kind,
            income_date=data.income_date,
            description=data.description.strip(),
            amount=data.amount,
            category=(data.category.strip() or None) if data.category else None,
            payment_mode=data.payment_mode,
            fuel_type=data.fuel_type,
            quantity_liters=data.quantity_liters,
            rate_per_liter=data.rate_per_liter,
            is_sale=data.is_sale,
            is_amount_mismatch=is_mismatch,
            items=items_dict,
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

        old_values = {
            "kind": income.kind.value,
            "income_date": str(income.income_date),
            "description": income.description,
            "amount": str(income.amount),
            "category": income.category,
            "payment_mode": income.payment_mode.value,
            "customer_id": str(income.customer_id) if income.customer_id else None,
        }

        old_customer = income.customer
        old_amount = income.amount

        # Resolve the target customer (if any) for loan expenses.
        new_customer = (
            self.customer_repository.resolve_or_create_customer(
                db,
                data.customer_uuid,
                data.customer_name,
            )
            if data.kind == IncomeKind.EXPENSE
            else None
        )

        # Calculate amount mismatch if fuel details/items were provided
        expected_sum = Decimal("0.00")
        has_calc = False

        if data.items and len(data.items) > 0:
            for item in data.items:
                if item.quantity_liters is not None and item.rate_per_liter is not None:
                    expected_sum += (item.quantity_liters * item.rate_per_liter)
                    has_calc = True
        elif data.quantity_liters is not None and data.rate_per_liter is not None:
            expected_sum = data.quantity_liters * data.rate_per_liter
            has_calc = True

        is_mismatch = False
        if has_calc:
            is_mismatch = abs(expected_sum - data.amount) > Decimal("1.00")

        items_dict = [i.model_dump(mode="json") for i in data.items] if data.items else None

        # Apply basic field updates on the Income row.
        income.kind = data.kind
        income.income_date = data.income_date
        income.description = data.description.strip()
        income.amount = data.amount
        income.category = (data.category.strip() or None) if data.category else None
        income.payment_mode = data.payment_mode
        income.fuel_type = data.fuel_type
        income.quantity_liters = data.quantity_liters
        income.rate_per_liter = data.rate_per_liter
        income.is_sale = data.is_sale
        income.is_amount_mismatch = is_mismatch
        income.items = items_dict
        income.customer_id = new_customer.id if new_customer else None

        # Manage ledger entry sync when customer links or loan amounts change.
        if old_customer is not None and (
            new_customer is None or old_customer.id != new_customer.id
        ):
            # Linked customer was removed or changed — reverse the old ledger entry.
            self.ledger_service.reverse_reference(
                db,
                old_customer,
                "INCOME",
                income.id,
                extra_deletes=[],
                actor_id=actor_id,
            )
            if new_customer is not None:
                # Post to the new customer.
                db.flush()
                self.ledger_service.post(
                    db,
                    new_customer,
                    LedgerEntryType.DEBIT_ADJUSTMENT,
                    data.amount,
                    entry_date=data.income_date,
                    reference_type="INCOME",
                    reference_id=income.id,
                    remarks=f"Loan — {income.description}",
                    actor_id=actor_id,
                )
        elif new_customer is not None and old_customer is None:
            # Customer was freshly added to an existing expense — post new entry.
            db.flush()
            self.ledger_service.post(
                db,
                new_customer,
                LedgerEntryType.DEBIT_ADJUSTMENT,
                data.amount,
                entry_date=data.income_date,
                reference_type="INCOME",
                reference_id=income.id,
                remarks=f"Loan — {income.description}",
                actor_id=actor_id,
            )
        elif new_customer is not None and old_customer is not None:
            # Same customer, but amount or date might have changed.
            if old_amount != data.amount or old_values["income_date"] != str(data.income_date):
                self.ledger_service.reverse_reference(
                    db,
                    old_customer,
                    "INCOME",
                    income.id,
                    extra_deletes=[],
                    actor_id=actor_id,
                )
                db.flush()
                self.ledger_service.post(
                    db,
                    old_customer,
                    LedgerEntryType.DEBIT_ADJUSTMENT,
                    data.amount,
                    entry_date=data.income_date,
                    reference_type="INCOME",
                    reference_id=income.id,
                    remarks=f"Loan — {income.description}",
                    actor_id=actor_id,
                )

        db.commit()
        db.refresh(income)

        self.audit_service.log_action(
            db,
            action="Updated Deposit" if data.kind == IncomeKind.DEPOSIT else "Updated Expense" if data.kind == IncomeKind.EXPENSE else "Updated Income",
            target_table="incomes",
            target_id=str(income.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values={
                "kind": data.kind.value,
                "income_date": str(data.income_date),
                "description": income.description,
                "amount": str(data.amount),
                "category": income.category,
                "payment_mode": data.payment_mode.value,
                "customer_id": str(income.customer_id) if income.customer_id else None,
            },
        )

        return income

    # -----------------------------------
    # Daily summary
    # -----------------------------------

    def get_daily_summary(
        self,
        db: Session,
        on_date: date,
    ) -> IncomeSummaryResponse:
        """Compute headline totals for a given date."""

        # Meter reading total per fuel type.
        rows = db.execute(
            select(
                Nozzle.fuel_type,
                func.coalesce(func.sum(NozzleReading.sales), 0.0),
            )
            .join(Nozzle, NozzleReading.nozzle_id == Nozzle.id)
            .where(NozzleReading.reading_date == on_date)
            .group_by(Nozzle.fuel_type)
        ).all()

        # Resolve active rate for each fuel type.
        at_time = datetime.combine(on_date, time.max, tzinfo=timezone.utc)

        fuel_sales: list[FuelSaleRow] = []
        total_sales = Decimal("0.00")

        for fuel_type, liters_raw in rows:
            liters = Decimal(str(liters_raw or 0)).quantize(Decimal("0.001"))
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

        # Sum of all customer payments received on this date.
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

        # Payment mode breakdowns for incomes, payments, and vouchers
        income_mode_rows = db.execute(
            select(
                Income.payment_mode,
                func.coalesce(func.sum(Income.amount), 0)
            )
            .where(Income.income_date == on_date)
            .where(Income.kind == IncomeKind.INCOME)
            .where(Income.is_active == True)
            .group_by(Income.payment_mode)
        ).all()
        income_by_mode = {mode: Decimal(str(amt)) for mode, amt in income_mode_rows}

        payment_mode_rows = db.execute(
            select(
                Payment.payment_mode,
                func.coalesce(func.sum(Payment.amount), 0)
            )
            .where(Payment.payment_date == on_date)
            .where(Payment.is_active == True)
            .group_by(Payment.payment_mode)
        ).all()
        payment_by_mode = {mode: Decimal(str(amt)) for mode, amt in payment_mode_rows}

        voucher_mode_rows = db.execute(
            select(
                Voucher.payment_mode,
                func.coalesce(func.sum(Voucher.total_amount), 0)
            )
            .where(Voucher.invoice_date == on_date)
            .where(Voucher.is_active == True)
            .group_by(Voucher.payment_mode)
        ).all()
        voucher_by_mode = {mode: Decimal(str(amt)) for mode, amt in voucher_mode_rows}

        # Non-cash counter sales (Income rows where is_sale == True and mode is non-cash)
        non_cash_sale_income_rows = db.execute(
            select(
                Income.payment_mode,
                func.coalesce(func.sum(Income.amount), 0)
            )
            .where(Income.income_date == on_date)
            .where(Income.kind == IncomeKind.INCOME)
            .where(Income.is_sale == True)
            .where(Income.is_active == True)
            .group_by(Income.payment_mode)
        ).all()
        def _get_mode_val(d: dict, mode: PaymentMode) -> Decimal:
            if mode in d:
                return d[mode]
            if mode.value in d:
                return d[mode.value]
            return Decimal("0.00")

        sale_income_by_mode = {mode: Decimal(str(amt)) for mode, amt in non_cash_sale_income_rows}

        income_upi = _get_mode_val(income_by_mode, PaymentMode.UPI)
        income_card = _get_mode_val(income_by_mode, PaymentMode.CARD)
        income_credit = _get_mode_val(income_by_mode, PaymentMode.CREDIT)

        payment_upi = _get_mode_val(payment_by_mode, PaymentMode.UPI)
        payment_card = _get_mode_val(payment_by_mode, PaymentMode.CARD)
        payment_credit = _get_mode_val(payment_by_mode, PaymentMode.CREDIT)

        voucher_upi = _get_mode_val(voucher_by_mode, PaymentMode.UPI)
        voucher_card = _get_mode_val(voucher_by_mode, PaymentMode.CARD)
        voucher_credit = _get_mode_val(voucher_by_mode, PaymentMode.CREDIT)

        total_upi = (income_upi + payment_upi + voucher_upi).quantize(Decimal("0.01"))
        total_card = (income_card + payment_card + voucher_card).quantize(Decimal("0.01"))
        total_credit = (income_credit + payment_credit + voucher_credit).quantize(Decimal("0.01"))
        total_non_cash = total_upi + total_card + total_credit

        # Expense breakdown by payment mode (All expenses reduce Cash in Hand UNLESS paid via non-cash mode UPI/Card/Credit)
        expense_mode_rows = db.execute(
            select(
                Income.payment_mode,
                func.coalesce(func.sum(Income.amount), 0)
            )
            .where(Income.income_date == on_date)
            .where(Income.kind == IncomeKind.EXPENSE)
            .where(Income.is_active == True)
            .group_by(Income.payment_mode)
        ).all()
        non_cash_expenses = Decimal("0.00")
        for mode, amt in expense_mode_rows:
            m_str = str(mode.value if hasattr(mode, "value") else mode).upper()
            if m_str in ["UPI", "CARD", "CREDIT"]:
                non_cash_expenses += Decimal(str(amt))

        # Cash expenses = Total Expenses minus non-cash expenses (UPI / Card / Credit)
        cash_expenses = max(Decimal("0.00"), (total_expenses - non_cash_expenses).quantize(Decimal("0.01")))

        # Sum of non-sale extra incomes (e.g. shop rent, decanting fee, scrap sales)
        extra_incomes = Decimal(
            str(
                db.scalar(
                    select(func.coalesce(func.sum(Income.amount), 0))
                    .where(Income.income_date == on_date)
                    .where(Income.kind == IncomeKind.INCOME)
                    .where(Income.is_sale == False)
                    .where(Income.is_active == True)
                )
                or 0
            )
        ).quantize(Decimal("0.01"))

        # Cash in Hand formula:
        # All nozzle meter sales (total_sales) are assumed to be cash initially.
        # Direct sales & vouchers with non-cash modes (UPI, Card, Credit) deduct from Cash in Hand.
        # Plus Extra Non-Sale Incomes and Customer Payments Received.
        # Minus Cash Expenses paid out and Bank Deposits made.
        total_inflows = total_sales + extra_incomes + total_payments
        cash_in_hand = max(
            Decimal("0.00"),
            (total_inflows - total_non_cash - cash_expenses - total_deposits).quantize(Decimal("0.01"))
        )

        return IncomeSummaryResponse(
            summary_date=on_date,
            fuel_sales=fuel_sales,
            total_sales=total_sales.quantize(Decimal("0.01")),
            total_incomes=total_incomes,
            total_expenses=total_expenses,
            total_deposits=total_deposits,
            total_payments=total_payments,
            total_upi=total_upi,
            total_card=total_card,
            total_credit=total_credit,
            cash_in_hand=cash_in_hand,
        )

    daily_summary = get_daily_summary
