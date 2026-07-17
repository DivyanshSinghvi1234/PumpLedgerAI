from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType, PaymentStatus, PaymentMode
from app.models.voucher_settlement import VoucherSettlement
from app.core.exceptions import (
    CustomerNotFoundError,
    SettlementError,
    VoucherNotFoundError,
)
from app.models.payment import Payment
from app.repositories.customer_repository import CustomerRepository
from app.repositories.voucher_repository import VoucherRepository
from app.schemas.payment import (
    PaymentAllocationCreate,
    VoucherSettleRequest,
)
from app.services.ledger_service import LedgerService


class VoucherPaymentService:
    """Applies payments to specific vouchers.

    Each allocation reduces a voucher's ``balance_due`` and, once the
    voucher is linked to a customer, posts a PAYMENT ledger entry so the
    customer's outstanding balance stays in sync. A single Payment row is
    recorded per receive action (its amount is the sum of allocations).
    """

    def __init__(self) -> None:
        self.customer_repository = CustomerRepository()
        self.voucher_repository = VoucherRepository()
        self.ledger_service = LedgerService()

    # -----------------------------------
    # Helpers
    # -----------------------------------

    @staticmethod
    def _apply_to_voucher(voucher, amount: Decimal) -> None:
        """Mutate a voucher's paid amount + status for a given payment."""
        if amount > voucher.balance_due:
            raise SettlementError(
                f"Payment of {amount} exceeds the balance due "
                f"({voucher.balance_due}) on invoice "
                f"{voucher.invoice_number}."
            )

        voucher.amount_paid = (voucher.amount_paid or Decimal("0.00")) + amount

        if voucher.balance_due <= Decimal("0.00"):
            voucher.payment_status = PaymentStatus.PAID
        elif voucher.amount_paid > Decimal("0.00"):
            voucher.payment_status = PaymentStatus.PARTIAL
        else:
            voucher.payment_status = PaymentStatus.UNPAID

    # -----------------------------------
    # Settle a single voucher
    # -----------------------------------

    def settle_voucher(
        self,
        db: Session,
        voucher_uuid: str,
        data: VoucherSettleRequest,
        actor_id: int | None = None,
    ):
        voucher = self.voucher_repository.get_by_uuid(db, voucher_uuid)

        if voucher is None:
            raise VoucherNotFoundError(voucher_uuid)

        self._apply_to_voucher(voucher, data.amount)

        customer = voucher.customer

        # Record the payment + ledger effect atomically. If the voucher has
        # no linked customer, we still update its paid amount (no ledger).
        if customer is not None:
            payment = Payment(
                customer_id=customer.id,
                amount=data.amount,
                payment_mode=data.payment_mode,
                payment_date=data.payment_date,
                reference_number=data.reference_number,
                remarks=(
                    data.remarks
                    or f"Settlement — invoice {voucher.invoice_number}"
                ),
            )
            db.add(payment)
            db.flush()

            self.ledger_service.post(
                db,
                customer,
                LedgerEntryType.PAYMENT,
                data.amount,
                entry_date=data.payment_date,
                reference_type="PAYMENT",
                reference_id=payment.id,
                remarks=payment.remarks,
                extra_objects=[voucher],
                actor_id=actor_id,
            )
        else:
            db.add(voucher)
            db.commit()

        db.refresh(voucher)
        return voucher

    # -----------------------------------
    # Allocate one payment across many vouchers
    # -----------------------------------

    def allocate_payment(
        self,
        db: Session,
        data: PaymentAllocationCreate,
        actor_id: int | None = None,
    ) -> Payment:
        customer = self.customer_repository.get_by_uuid(
            db,
            str(data.customer_uuid),
        )

        if customer is None:
            raise CustomerNotFoundError(str(data.customer_uuid))

        total = Decimal("0.00")
        touched = []

        for alloc in data.allocations:
            voucher = self.voucher_repository.get_by_uuid(
                db,
                str(alloc.voucher_uuid),
            )

            if voucher is None:
                raise VoucherNotFoundError(str(alloc.voucher_uuid))

            if voucher.customer_id != customer.id:
                raise SettlementError(
                    f"Invoice {voucher.invoice_number} does not belong "
                    f"to {customer.name}."
                )

            self._apply_to_voucher(voucher, alloc.amount)
            total += alloc.amount
            touched.append(voucher)

        # One Payment row for the whole receive action; one ledger PAYMENT
        # entry carries the total and commits every touched voucher together.
        payment = Payment(
            customer_id=customer.id,
            amount=total,
            payment_mode=data.payment_mode,
            payment_date=data.payment_date,
            reference_number=data.reference_number,
            remarks=data.remarks or "Voucher settlement",
        )
        db.add(payment)
        db.flush()

        self.ledger_service.post(
            db,
            customer,
            LedgerEntryType.PAYMENT,
            total,
            entry_date=data.payment_date,
            reference_type="PAYMENT",
            reference_id=payment.id,
            remarks=payment.remarks,
            extra_objects=touched,
            actor_id=actor_id,
        )

        db.refresh(payment)
        return payment

    def allocate_payment_fifo(
        self,
        db: Session,
        customer_uuid: str,
        amount: Decimal,
        payment_mode: PaymentMode,
        payment_date: date,
        reference_number: str | None = None,
        remarks: str | None = None,
        actor_id: int | None = None,
    ) -> Payment:
        """
        Apply a payment to the customer's oldest outstanding vouchers first (FIFO).
        Returns the created Payment with all voucher settlements.
        """
        customer = self.customer_repository.get_by_uuid(db, customer_uuid)
        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        # Get ALL unpaid/partially paid vouchers for this customer, ordered by invoice_date ASC (oldest first)
        vouchers = self.voucher_repository.list_for_customer_fifo(db, customer.id)

        # Create single payment row
        payment = Payment(
            customer_id=customer.id,
            amount=amount,
            payment_mode=payment_mode,
            payment_date=payment_date,
            reference_number=reference_number,
            remarks=remarks or "FIFO settlement",
        )
        db.add(payment)
        db.flush()

        total_allocated = Decimal("0.00")
        touched = []
        remaining = amount

        for voucher in vouchers:
            if remaining <= Decimal("0.00"):
                break
            
            due = voucher.balance_due
            alloc_amount = min(remaining, due)
            
            if alloc_amount > Decimal("0.00"):
                self._apply_to_voucher(voucher, alloc_amount)
                total_allocated += alloc_amount
                remaining -= alloc_amount
                touched.append(voucher)
                
                # Create settlement link
                settlement = VoucherSettlement(
                    payment_id=payment.id,
                    voucher_id=voucher.id,
                    amount=alloc_amount,
                )
                db.add(settlement)

        # Update payment amount to what was actually allocated
        payment.amount = total_allocated

        # Post single ledger entry for total allocated amount if it is greater than zero
        if total_allocated > 0:
            self.ledger_service.post(
                db,
                customer,
                LedgerEntryType.PAYMENT,
                total_allocated,
                entry_date=payment_date,
                reference_type="PAYMENT",
                reference_id=payment.id,
                remarks=payment.remarks,
                extra_objects=touched,
                actor_id=actor_id,
            )

        db.refresh(payment)
        return payment
