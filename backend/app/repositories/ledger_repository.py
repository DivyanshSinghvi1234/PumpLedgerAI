from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger_entry import LedgerEntry
from app.repositories.base_repository import BaseRepository


class LedgerRepository(BaseRepository[LedgerEntry]):

    def __init__(self) -> None:
        super().__init__(LedgerEntry)

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
