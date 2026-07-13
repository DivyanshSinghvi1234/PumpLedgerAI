from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType, PaymentStatus
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
        )

        db.refresh(payment)
        return payment
