from __future__ import annotations

from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType, PaymentMode, PaymentStatus
from app.core.exceptions import (
    CustomerNotFoundError,
    PaymentNotFoundError,
)
from app.models.payment import Payment
from app.repositories.customer_repository import CustomerRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreate
from app.services.ledger_service import LedgerService
from app.services.audit_log_service import AuditLogService


class PaymentService:

    def __init__(self) -> None:
        self.repository = PaymentRepository()
        self.customer_repository = CustomerRepository()
        self.ledger_service = LedgerService()
        self.audit_service = AuditLogService()

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: PaymentCreate,
        actor_id: int | None = None,
    ) -> Payment:

        from app.services.day_closing_service import DayClosingService
        DayClosingService.ensure_day_open(db, data.payment_date)

        customer = self.customer_repository.get_by_uuid(
            db,
            str(data.customer_uuid),
        )

        if customer is None:
            raise CustomerNotFoundError(
                str(data.customer_uuid),
            )

        payment = Payment(
            customer_id=customer.id,
            amount=data.amount,
            payment_mode=data.payment_mode,
            cash_amount=data.cash_amount,
            bank_amount=data.bank_amount,
            payment_date=data.payment_date,
            reference_number=data.reference_number,
            remarks=data.remarks,
        )

        # Flush to assign payment.id so the ledger entry can reference it.
        db.add(payment)
        db.flush()

        # Sync to selected BankAccount (e.g. HDFC, SBI) if provided
        bank_sync_amount = (
            (data.bank_amount or Decimal("0.00"))
            if data.payment_mode == PaymentMode.SPLIT
            else data.amount
        )
        if data.bank_account_uuid and bank_sync_amount > Decimal("0.00"):
            from app.services.bank_account_service import BankAccountService

            acc = BankAccountService().sync_from_entity(
                db,
                bank_account_uuid=data.bank_account_uuid,
                amount=bank_sync_amount,
                transaction_type="INCOME",
                transaction_date=data.payment_date,
                reference_number=f"PAY-{payment.id}",
                remarks=f"Customer Payment ({customer.name}) · {data.payment_mode.value}",
                pump_id=payment.pump_id,
            )
            if acc is not None:
                payment.bank_account_id = acc.id

        # The ledger is the single balance writer: posting a PAYMENT entry
        # decrements outstanding_balance and commits the payment row in the
        # same transaction. Overpayment is allowed (balance may go negative).
        self.ledger_service.post(
            db,
            customer,
            LedgerEntryType.PAYMENT,
            data.amount,
            entry_date=data.payment_date,
            reference_type="PAYMENT",
            reference_id=payment.id,
            remarks=data.remarks,
            extra_objects=[payment],
            actor_id=actor_id,
        )

        # Auto-settle customer's oldest unpaid vouchers (FIFO) when enabled
        if getattr(data, "auto_allocate_fifo", True):
            from app.core.enums import PaymentStatus
            from app.models.voucher_settlement import VoucherSettlement
            from app.repositories.voucher_repository import VoucherRepository

            remaining = Decimal(str(data.amount))
            unpaid_vouchers = VoucherRepository().list_for_customer_fifo(db, customer.id)
            touched = []
            for v in unpaid_vouchers:
                if remaining <= Decimal("0.00"):
                    break
                due = v.balance_due
                alloc = min(remaining, due)
                if alloc > Decimal("0.00"):
                    v.amount_paid = (v.amount_paid or Decimal("0.00")) + alloc
                    if v.balance_due <= Decimal("0.00"):
                        v.payment_status = PaymentStatus.PAID
                    else:
                        v.payment_status = PaymentStatus.PARTIAL
                    db.add(v)
                    db.add(
                        VoucherSettlement(
                            payment_id=payment.id,
                            voucher_id=v.id,
                            amount=alloc,
                        )
                    )
                    touched.append(v)
                    remaining -= alloc
            if touched:
                db.commit()

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Received Payment",
            target_table="payments",
            target_id=str(payment.id),
            actor_id=actor_id,
            new_values={
                "customer_id": str(customer.id),
                "amount": str(data.amount),
                "payment_mode": data.payment_mode.value,
                "payment_date": str(data.payment_date),
                "reference_number": data.reference_number,
                "remarks": data.remarks,
            }
        )

        return payment

    # -----------------------------------
    # Search
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        customer_uuid: str | None = None,
        search: str | None = None,
        payment_date: date | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Payment], int]:

        return self.repository.search(
            db,
            customer_uuid=customer_uuid,
            search=search,
            payment_date=payment_date,
            page=page,
            page_size=page_size,
        )

    # -----------------------------------
    # Get By UUID
    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        payment_uuid: str,
    ) -> Payment:

        payment = self.repository.get_by_uuid(
            db,
            payment_uuid,
        )

        if payment is None:
            raise PaymentNotFoundError(
                payment_uuid,
            )

        from app.services.day_closing_service import DayClosingService
        DayClosingService.ensure_day_open(db, payment.payment_date)

        return payment

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        payment_uuid: str,
        actor_id: int | None = None,
    ) -> None:

        payment = self.repository.get_by_uuid(
            db,
            payment_uuid,
        )

        if payment is None:
            raise PaymentNotFoundError(
                payment_uuid,
            )

        from app.services.day_closing_service import DayClosingService
        DayClosingService.ensure_day_open(db, payment.payment_date)

        # Capture old values for audit log
        old_values = {
            "customer_id": str(payment.customer_id),
            "amount": str(payment.amount),
            "payment_mode": payment.payment_mode.value,
            "payment_date": str(payment.payment_date),
            "reference_number": payment.reference_number,
            "remarks": payment.remarks,
        }

        # Reverse the allocations on the settled vouchers by decrementing
        # amount_paid and setting payment_status back accordingly.
        for settlement in payment.settlements:
            voucher = settlement.voucher
            if voucher:
                voucher.amount_paid = max(
                    Decimal("0.00"),
                    (voucher.amount_paid or Decimal("0.00")) - settlement.amount
                )
                if voucher.amount_paid <= Decimal("0.00"):
                    voucher.payment_status = PaymentStatus.UNPAID
                elif voucher.amount_paid < voucher.total_amount:
                    voucher.payment_status = PaymentStatus.PARTIAL
                else:
                    voucher.payment_status = PaymentStatus.PAID
                db.add(voucher)

        # Reverse any synced BankTransaction if this payment hit a bank account
        if payment.bank_account_id is not None:
            from app.services.bank_account_service import BankAccountService

            BankAccountService().reverse_by_reference(db, f"PAY-{payment.id}")

        # Reversing the PAYMENT ledger entry restores the balance and
        # deletes the payment row in one transaction.
        self.ledger_service.reverse_reference(
            db,
            payment.customer,
            "PAYMENT",
            payment.id,
            extra_deletes=[payment],
            actor_id=actor_id,
        )

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Payment",
            target_table="payments",
            target_id=str(payment.id),
            actor_id=actor_id,
            old_values=old_values,
        )


