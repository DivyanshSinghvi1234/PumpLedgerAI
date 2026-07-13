from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.enums import LedgerEntryType, signed_amount
from app.core.exceptions import CustomerNotFoundError
from app.models.customer import Customer
from app.models.ledger_entry import LedgerEntry
from app.repositories.customer_repository import CustomerRepository
from app.repositories.ledger_repository import LedgerRepository
from app.schemas.ledger import (
    LedgerAdjustmentCreate,
    LedgerEntryResponse,
    LedgerListResponse,
)


class LedgerService:
    """
    The single writer of customer balances. Every balance change in the
    system flows through ``post`` / ``reverse_reference`` so that
    ``customers.outstanding_balance`` always equals the running total of
    that customer's ledger entries.
    """

    def __init__(self) -> None:
        self.repository = LedgerRepository()
        self.customer_repository = CustomerRepository()

    # -----------------------------------
    # Post an entry (sole balance writer)
    # -----------------------------------

    def post(
        self,
        db: Session,
        customer: Customer,
        entry_type: LedgerEntryType,
        amount: Decimal,
        *,
        entry_date: date,
        reference_type: str | None = None,
        reference_id: int | None = None,
        remarks: str | None = None,
        extra_objects=(),
    ) -> LedgerEntry:

        new_balance = (
            customer.outstanding_balance
            + signed_amount(entry_type, amount)
        )

        entry = LedgerEntry(
            customer_id=customer.id,
            entry_type=entry_type,
            amount=amount,
            entry_date=entry_date,
            reference_type=reference_type,
            reference_id=reference_id,
            remarks=remarks,
        )

        return self.repository.post(
            db,
            entry,
            customer,
            new_balance,
            extra_objects=extra_objects,
        )

    # -----------------------------------
    # Reverse all entries for a source row
    # -----------------------------------

    def reverse_reference(
        self,
        db: Session,
        customer: Customer,
        reference_type: str,
        reference_id: int,
        *,
        extra_deletes=(),
    ) -> None:

        entries = self.repository.get_entries_by_reference(
            db,
            reference_type,
            reference_id,
        )

        # Undo the net signed effect of the entries being removed.
        undo = sum(
            (
                signed_amount(e.entry_type, e.amount)
                for e in entries
            ),
            Decimal("0.00"),
        )

        new_balance = customer.outstanding_balance - undo

        self.repository.remove(
            db,
            entries,
            customer,
            new_balance,
            extra_deletes=extra_deletes,
        )

    # -----------------------------------
    # Manual adjustment
    # -----------------------------------

    def create_adjustment(
        self,
        db: Session,
        customer_uuid: str,
        data: LedgerAdjustmentCreate,
    ) -> LedgerEntry:

        customer = self.customer_repository.get_by_uuid(
            db,
            customer_uuid,
        )

        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        return self.post(
            db,
            customer,
            data.entry_type,
            data.amount,
            entry_date=data.entry_date,
            reference_type="ADJUSTMENT",
            remarks=data.remarks,
        )

    # -----------------------------------
    # Read: ledger with running balance
    # -----------------------------------

    def list_for_customer(
        self,
        db: Session,
        customer_uuid: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> LedgerListResponse:

        customer = self.customer_repository.get_by_uuid(
            db,
            customer_uuid,
        )

        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        entries = self.repository.list_for_customer(
            db,
            customer.id,
        )

        # Compute the running balance across the FULL chronological
        # series so balance_after is correct regardless of page.
        running = Decimal("0.00")
        enriched: list[LedgerEntryResponse] = []

        for entry in entries:
            signed = signed_amount(
                entry.entry_type,
                entry.amount,
            )
            running += signed

            enriched.append(
                LedgerEntryResponse(
                    uuid=entry.uuid,
                    entry_type=entry.entry_type,
                    amount=entry.amount,
                    signed_amount=signed,
                    balance_after=running,
                    entry_date=entry.entry_date,
                    reference_type=entry.reference_type,
                    remarks=entry.remarks,
                )
            )

        total = len(enriched)

        start = (page - 1) * page_size
        end = start + page_size
        page_items = enriched[start:end]

        # Opening balance for THIS page = running balance just before
        # its first entry (0 for page 1).
        opening = (
            enriched[start - 1].balance_after
            if start > 0 and start <= total
            else Decimal("0.00")
        )

        return LedgerListResponse(
            customer_uuid=customer.uuid,
            customer_name=customer.name,
            opening_balance=opening,
            closing_balance=running,
            items=page_items,
            pagination=build_pagination(
                page=page,
                page_size=page_size,
                total_items=total,
            ),
        )

    # -----------------------------------
    # Read: date-filtered statement (for reports)
    # -----------------------------------

    def statement_for_customer(
        self,
        db: Session,
        customer_uuid: str,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> dict:
        """
        A customer account statement over an optional date range.

        The running balance is computed over the FULL chronological series
        (so balances stay correct), then rows are filtered to the range.
        ``opening_balance`` is the running balance just before the first
        in-range entry; ``closing_balance`` is the balance at the last
        in-range entry (or opening if the range is empty).
        """

        customer = self.customer_repository.get_by_uuid(
            db,
            customer_uuid,
        )

        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        entries = self.repository.list_for_customer(
            db,
            customer.id,
        )

        running = Decimal("0.00")
        opening = Decimal("0.00")
        rows: list[dict] = []
        seen_in_range = False

        for entry in entries:
            before = running
            signed = signed_amount(entry.entry_type, entry.amount)
            running += signed

            in_range = True
            if from_date and entry.entry_date < from_date:
                in_range = False
            if to_date and entry.entry_date > to_date:
                in_range = False

            if not in_range:
                continue

            if not seen_in_range:
                opening = before
                seen_in_range = True

            rows.append(
                {
                    "entry_type": entry.entry_type.value,
                    "amount": entry.amount,
                    "signed_amount": signed,
                    "balance_after": running,
                    "entry_date": entry.entry_date,
                    "reference_type": entry.reference_type,
                    "remarks": entry.remarks,
                }
            )

        closing = rows[-1]["balance_after"] if rows else opening

        return {
            "customer_uuid": customer.uuid,
            "customer_name": customer.name,
            "from_date": from_date,
            "to_date": to_date,
            "opening_balance": opening,
            "closing_balance": closing,
            "rows": rows,
            "count": len(rows),
        }
