from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy import case, func

from app.core.enums import DEBIT_ENTRY_TYPES
from app.models.ledger_entry import LedgerEntry
from app.repositories.base_repository import BaseRepository


class LedgerRepository(BaseRepository[LedgerEntry]):

    def __init__(self) -> None:
        super().__init__(LedgerEntry)

    # -----------------------------------
    # Live balance (signed sum of entries)
    # -----------------------------------

    def outstanding_for_customer(
        self,
        db: Session,
        customer_id: int,
    ) -> Decimal:
        """Compute a customer's outstanding balance live from the signed sum
        of their active ledger entries — the same definition the cached
        ``customers.outstanding_balance`` holds, but read straight from the
        source rows so it can never drift."""

        signed = case(
            (
                LedgerEntry.entry_type.in_(list(DEBIT_ENTRY_TYPES)),
                LedgerEntry.amount,
            ),
            else_=-LedgerEntry.amount,
        )

        total = db.scalar(
            select(func.coalesce(func.sum(signed), 0)).where(
                LedgerEntry.customer_id == customer_id,
                LedgerEntry.is_active.is_(True),
            )
        )

        return Decimal(str(total or "0.00"))

    def outstanding_for_customers(
        self,
        db: Session,
        customer_ids: list[int],
    ) -> dict[int, Decimal]:
        """Bulk variant of ``outstanding_for_customer`` — one grouped query for
        a page of customers, avoiding an N+1 on the customer list."""

        if not customer_ids:
            return {}

        signed = case(
            (
                LedgerEntry.entry_type.in_(list(DEBIT_ENTRY_TYPES)),
                LedgerEntry.amount,
            ),
            else_=-LedgerEntry.amount,
        )

        rows = db.execute(
            select(
                LedgerEntry.customer_id,
                func.coalesce(func.sum(signed), 0),
            )
            .where(
                LedgerEntry.customer_id.in_(customer_ids),
                LedgerEntry.is_active.is_(True),
            )
            .group_by(LedgerEntry.customer_id)
        ).all()

        totals = {cid: Decimal(str(amt or "0.00")) for cid, amt in rows}

        # Customers with no ledger rows still need an explicit zero.
        return {cid: totals.get(cid, Decimal("0.00")) for cid in customer_ids}

    # -----------------------------------
    # List (chronological, full series)
    # -----------------------------------

    def list_for_customer(
        self,
        db: Session,
        customer_id: int,
    ) -> list[LedgerEntry]:
        """
        Return ALL active entries for a customer in chronological order
        (entry_date, id). Per-customer ledgers are small, so we compute
        the running balance over the full series and paginate in the
        service — this keeps balance_after correct across page borders.
        """

        return list(
            db.scalars(
                select(LedgerEntry)
                .where(
                    LedgerEntry.customer_id == customer_id,
                    LedgerEntry.is_active.is_(True),
                )
                .order_by(
                    LedgerEntry.entry_date,
                    LedgerEntry.id,
                )
            ).all()
        )

    # -----------------------------------
    # Reversal lookup
    # -----------------------------------

    def get_entries_by_reference(
        self,
        db: Session,
        reference_type: str,
        reference_id: int,
    ) -> list[LedgerEntry]:

        return list(
            db.scalars(
                select(LedgerEntry).where(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.is_active.is_(True),
                )
            ).all()
        )

    # -----------------------------------
    # Atomic post (entry + balance + source row)
    # -----------------------------------

    def post(
        self,
        db: Session,
        entry: LedgerEntry,
        customer,
        new_balance: Decimal,
        extra_objects: Iterable[object] = (),
    ) -> LedgerEntry:
        """
        Persist the ledger entry, update the customer's cached balance,
        and persist any source rows (payment/voucher) in ONE transaction.
        """

        try:
            for obj in extra_objects:
                db.add(obj)

            db.add(entry)

            customer.outstanding_balance = new_balance
            db.add(customer)

            db.commit()

        except Exception:
            db.rollback()
            raise

        db.refresh(entry)
        db.refresh(customer)

        return entry

    # -----------------------------------
    # Atomic remove (reversal)
    # -----------------------------------

    def remove(
        self,
        db: Session,
        entries: Iterable[LedgerEntry],
        customer,
        new_balance: Decimal,
        extra_deletes: Iterable[object] = (),
    ) -> None:
        """
        Delete ledger entries (and any source rows), restore the
        customer's cached balance, in ONE transaction.
        """

        try:
            for entry in entries:
                db.delete(entry)

            for obj in extra_deletes:
                db.delete(obj)

            customer.outstanding_balance = new_balance
            db.add(customer)

            db.commit()

        except Exception:
            db.rollback()
            raise

        db.refresh(customer)
