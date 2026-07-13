from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType
from app.core.exceptions import (
    CustomerNotFoundError,
    PaymentNotFoundError,
)
from app.models.payment import Payment
from app.repositories.customer_repository import CustomerRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreate
from app.services.ledger_service import LedgerService


class PaymentService:

    def __init__(self) -> None:
        self.repository = PaymentRepository()
        self.customer_repository = CustomerRepository()
        self.ledger_service = LedgerService()

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: PaymentCreate,
    ) -> Payment:

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
            payment_date=data.payment_date,
            reference_number=data.reference_number,
            remarks=data.remarks,
        )

        # Flush to assign payment.id so the ledger entry can reference it.
        db.add(payment)
        db.flush()

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
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Payment], int]:

        return self.repository.search(
            db,
            customer_uuid=customer_uuid,
            search=search,
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

        return payment

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        payment_uuid: str,
    ) -> None:

        payment = self.repository.get_by_uuid(
            db,
            payment_uuid,
        )

        if payment is None:
            raise PaymentNotFoundError(
                payment_uuid,
            )

        # Reversing the PAYMENT ledger entry restores the balance and
        # deletes the payment row in one transaction.
        self.ledger_service.reverse_reference(
            db,
            payment.customer,
            "PAYMENT",
            payment.id,
            extra_deletes=[payment],
        )

