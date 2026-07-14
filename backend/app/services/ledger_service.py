from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.common.pagination import build_pagination
from app.core.enums import LedgerEntryType, signed_amount, PaymentStatus
from app.core.exceptions import CustomerNotFoundError
from app.models.customer import Customer
from app.models.ledger_entry import LedgerEntry
from app.repositories.customer_repository import CustomerRepository
from app.repositories.ledger_repository import LedgerRepository
from app.services.audit_log_service import AuditLogService
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
        self.audit_service = AuditLogService()

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
        actor_id: int | None = None,
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

        res = self.repository.post(
            db,
            entry,
            customer,
            new_balance,
            extra_objects=extra_objects,
        )

        # Log audit log
        self.audit_service.log_action(
            db,
            action=f"POST_LEDGER_{entry_type.value}",
            target_table="ledger_entries",
            target_id=str(res.id),
            actor_id=actor_id,
            new_values={
                "customer_uuid": customer.uuid,
                "amount": str(amount),
                "entry_type": entry_type.value,
                "entry_date": str(entry_date),
                "reference_type": reference_type,
                "reference_id": reference_id,
            }
        )

        return res

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
        actor_id: int | None = None,
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

        # Log audit log
        for e in entries:
            self.audit_service.log_action(
                db,
                action=f"REVERSE_LEDGER_{e.entry_type.value}",
                target_table="ledger_entries",
                target_id=str(e.id),
                actor_id=actor_id,
                old_values={
                    "customer_uuid": customer.uuid,
                    "amount": str(e.amount),
                    "entry_type": e.entry_type.value,
                    "entry_date": str(e.entry_date),
                    "reference_type": reference_type,
                    "reference_id": reference_id,
                }
            )

    # -----------------------------------
    # Manual adjustment
    # -----------------------------------

    def create_adjustment(
        self,
        db: Session,
        customer_uuid: str,
        data: LedgerAdjustmentCreate,
        actor_id: int | None = None,
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
            actor_id=actor_id,
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
        from sqlalchemy import select
        from app.models.voucher import Voucher

        voucher_ids = {
            entry.reference_id
            for entry in entries
            if entry.reference_type == "VOUCHER" and entry.reference_id is not None
        }
        vouchers_map = {}
        if voucher_ids:
            vouchers = db.scalars(
                select(Voucher).where(Voucher.id.in_(voucher_ids))
            ).all()
            vouchers_map = {v.id: v for v in vouchers}

        running = Decimal("0.00")
        enriched: list[LedgerEntryResponse] = []

        for entry in entries:
            signed = signed_amount(
                entry.entry_type,
                entry.amount,
            )
            running += signed

            voucher = None
            if entry.reference_type == "VOUCHER" and entry.reference_id is not None:
                voucher = vouchers_map.get(entry.reference_id)

            image_path = voucher.image_path if voucher else None
            invoice_number = voucher.invoice_number if voucher else None

            # Determine entry status (Pending or Completed)
            status_val = None
            if entry.entry_type == LedgerEntryType.VOUCHER and voucher:
                status_val = "Completed" if voucher.payment_status == PaymentStatus.PAID else "Pending"
            elif entry.entry_type == LedgerEntryType.PAYMENT:
                status_val = "Completed"

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
                    image_path=image_path,
                    invoice_number=invoice_number,
                    status=status_val,
                )
            )

        # Reverse the chronological list so that newest entries appear first (descending)
        enriched.reverse()
        total = len(enriched)

        start = (page - 1) * page_size
        end = start + page_size
        page_items = enriched[start:end]

        # Since list is descending (newest first), the opening balance for this page
        # is the balance after the entry that occurred chronologically before its oldest item.
        # That is the entry at index `end` (or 0.00 if at the end of the list).
        opening = (
            enriched[end].balance_after
            if end < total
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

    def list_for_customer_grouped_by_date(
        self,
        db: Session,
        customer_uuid: str,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> dict:
        """
        Returns ledger entries grouped by entry_date with voucher status info.
        """
        customer = self.customer_repository.get_by_uuid(db, customer_uuid)
        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        entries = self.repository.list_for_customer(db, customer.id)
        
        # Load vouchers if any entry is a VOUCHER
        from sqlalchemy import select
        from app.models.voucher import Voucher
        
        voucher_ids = {
            e.reference_id
            for e in entries
            if e.reference_type == "VOUCHER" and e.reference_id is not None
        }
        vouchers_map = {}
        if voucher_ids:
            vouchers = db.scalars(
                select(Voucher).where(Voucher.id.in_(voucher_ids))
            ).all()
            vouchers_map = {v.id: v for v in vouchers}

        # Apply date filters & calculate running balance
        running = Decimal("0.00")
        
        # Group entries by date
        from collections import defaultdict
        grouped = defaultdict(list)
        
        for entry in entries:
            signed = signed_amount(entry.entry_type, entry.amount)
            running += signed
            
            # Apply date filters
            if from_date and entry.entry_date < from_date:
                continue
            if to_date and entry.entry_date > to_date:
                continue
                
            voucher = vouchers_map.get(entry.reference_id) if (entry.reference_type == "VOUCHER" and entry.reference_id is not None) else None
            
            grouped[entry.entry_date].append({
                "uuid": entry.uuid,
                "entry_type": entry.entry_type,
                "amount": entry.amount,
                "signed_amount": signed,
                "balance_after": running,
                "remarks": entry.remarks,
                "reference_type": entry.reference_type,
                "reference_id": entry.reference_id,
                "voucher_status": voucher.payment_status.value if voucher else None,
                "invoice_number": voucher.invoice_number if voucher else None,
            })

        # Sort dates ascending for statement view
        sorted_dates = sorted(grouped.keys())
        groups = []
        
        # Calculate opening balance before the first in-range group
        opening_balance = Decimal("0.00")
        if entries and from_date:
            running_temp = Decimal("0.00")
            for entry in entries:
                signed = signed_amount(entry.entry_type, entry.amount)
                if entry.entry_date < from_date:
                    running_temp += signed
                else:
                    break
            opening_balance = running_temp
        else:
            opening_balance = Decimal("0.00")

        for d in sorted_dates:
            entries_for_date = grouped[d]
            total_debit = sum(e["signed_amount"] for e in entries_for_date if e["signed_amount"] > 0)
            total_credit = sum(-e["signed_amount"] for e in entries_for_date if e["signed_amount"] < 0)
            closing_balance = entries_for_date[-1]["balance_after"]
            
            groups.append({
                "date": d,
                "total_debit": total_debit,
                "total_credit": total_credit,
                "closing_balance": closing_balance,
                "entries": entries_for_date,
            })
            
        closing_balance_total = groups[-1]["closing_balance"] if groups else opening_balance
        
        return {
            "customer_uuid": customer.uuid,
            "customer_name": customer.name,
            "opening_balance": opening_balance,
            "closing_balance": closing_balance_total,
            "groups": groups,
        }
