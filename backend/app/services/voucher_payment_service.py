from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType, PaymentStatus, PaymentMode
from app.models.voucher_settlement import VoucherSettlement
from app.core.exceptions import (
    CustomerNotFoundError,
    SettlementError,
    VoucherNotFoundError,
)
from app.models.payment import Payment
from app.models.voucher import Voucher
from app.repositories.customer_repository import CustomerRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.repositories.voucher_repository import VoucherRepository
from app.schemas.payment import (
    PaymentAllocationCreate,
    VoucherSettleRequest,
)
from app.services.ledger_service import LedgerService
from app.services.audit_log_service import AuditLogService


class VoucherPaymentService:
    """Applies payments to specific vouchers.

    Each allocation reduces a voucher's ``balance_due`` and, once the
    voucher is linked to a customer, posts a PAYMENT ledger entry so the
    customer's outstanding balance stays in sync. A single Payment row is
    recorded per receive action (its amount is the sum of allocations).
    """

    def __init__(self) -> None:
        self.customer_repository = CustomerRepository()
        self.vehicle_repository = VehicleRepository()
        self.voucher_repository = VoucherRepository()
        self.ledger_service = LedgerService()
        self.audit_service = AuditLogService()

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

        bank_account_id = None
        if getattr(data, "bank_account_uuid", None):
            from app.models.bank_account import BankAccount, BankTransaction
            ba = db.scalars(select(BankAccount).where(BankAccount.uuid == str(data.bank_account_uuid))).first()
            if ba:
                bank_account_id = ba.id
                ba.current_balance = ba.current_balance + data.amount
                txn = BankTransaction(
                    bank_account_id=ba.id,
                    transaction_type="INCOME",
                    amount=data.amount,
                    transaction_date=data.payment_date,
                    reference_number=data.reference_number,
                    remarks=f"Voucher Settlement — Invoice #{voucher.invoice_number}",
                    pump_id=ba.pump_id,
                )
                db.add(txn)

        if customer is not None:
            payment = Payment(
                customer_id=customer.id,
                amount=data.amount,
                payment_mode=data.payment_mode,
                payment_date=data.payment_date,
                reference_number=data.reference_number,
                bank_account_id=bank_account_id,
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

            # Log audit log
            self.audit_service.log_action(
                db,
                action="Received Payment (Voucher Settlement)",
                target_table="payments",
                target_id=str(payment.id),
                actor_id=actor_id,
                new_values={
                    "customer_id": str(customer.id),
                    "amount": str(data.amount),
                    "payment_mode": data.payment_mode.value,
                    "payment_date": str(data.payment_date),
                    "reference_number": data.reference_number,
                    "remarks": payment.remarks,
                    "voucher_id": str(voucher.id),
                    "invoice_number": voucher.invoice_number,
                }
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

        allocation_sum = sum(alloc.amount for alloc in data.allocations)
        if allocation_sum != data.amount:
            raise SettlementError(
                f"The sum of allocations ({allocation_sum}) does not equal the payment amount ({data.amount})."
            )

        total = Decimal("0.00")
        touched = []

        for alloc in data.allocations:
            # Query with row lock to prevent concurrent allocation race conditions
            voucher = db.scalar(
                select(Voucher)
                .where(Voucher.uuid == str(alloc.voucher_uuid))
                .with_for_update()
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

        bank_account_id = None
        if getattr(data, "bank_account_uuid", None):
            from app.models.bank_account import BankAccount, BankTransaction
            ba = db.scalars(select(BankAccount).where(BankAccount.uuid == str(data.bank_account_uuid))).first()
            if ba:
                bank_account_id = ba.id
                ba.current_balance = ba.current_balance + total
                txn = BankTransaction(
                    bank_account_id=ba.id,
                    transaction_type="INCOME",
                    amount=total,
                    transaction_date=data.payment_date,
                    reference_number=data.reference_number,
                    remarks=f"Customer Payment from {customer.name}",
                    pump_id=ba.pump_id,
                )
                db.add(txn)

        # One Payment row for the whole receive action; one ledger PAYMENT
        # entry carries the total and commits every touched voucher together.
        payment = Payment(
            customer_id=customer.id,
            amount=total,
            payment_mode=data.payment_mode,
            payment_date=data.payment_date,
            reference_number=data.reference_number,
            bank_account_id=bank_account_id,
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

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Received Payment (Voucher Allocation)",
            target_table="payments",
            target_id=str(payment.id),
            actor_id=actor_id,
            new_values={
                "customer_id": str(customer.id),
                "amount": str(total),
                "payment_mode": data.payment_mode.value,
                "payment_date": str(data.payment_date),
                "reference_number": data.reference_number,
                "remarks": payment.remarks,
                "voucher_count": len(touched),
            }
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
        vehicle_uuid: str | None = None,
        vehicle_number: str | None = None,
        actor_id: int | None = None,
    ) -> Payment:
        """
        Apply a payment to the customer's oldest outstanding vouchers first (FIFO).
        When ``vehicle_uuid`` or ``vehicle_number`` is given, only that vehicle's
        vouchers are settled — letting a payment be earmarked to one vehicle's dues
        while still posting a single PAYMENT entry to the shared customer ledger.
        Returns the created Payment with all voucher settlements.
        """
        from app.common.normalization import normalize_vehicle_number
        from app.models.vehicle import Vehicle

        customer = self.customer_repository.get_by_uuid(db, customer_uuid)
        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        # Optionally scope FIFO to a single vehicle owned by this customer.
        vehicle: Vehicle | None = None
        if vehicle_uuid:
            vehicle = self.vehicle_repository.get_by_uuid(db, vehicle_uuid)
            if vehicle is None or vehicle.customer_id != customer.id:
                raise SettlementError(
                    "Vehicle does not belong to this customer."
                )
        elif vehicle_number and vehicle_number.strip():
            normalized = normalize_vehicle_number(vehicle_number)
            if normalized:
                vehicle = self.vehicle_repository.get_by_normalized(db, normalized)
                if vehicle and vehicle.customer_id != customer.id:
                    raise SettlementError(
                        "Vehicle belongs to a different customer."
                    )
                if vehicle is None:
                    vehicle = self.vehicle_repository.create(
                        db,
                        Vehicle(
                            customer_id=customer.id,
                            vehicle_number=vehicle_number.strip(),
                            normalized_number=normalized,
                        ),
                    )

        vehicle_id: int | None = vehicle.id if vehicle else None
        norm_num: str | None = (
            vehicle.normalized_number
            if vehicle
            else normalize_vehicle_number(vehicle_number)
        )

        # Get ALL unpaid/partially paid vouchers for this customer (optionally
        # for one vehicle), ordered by invoice_date ASC (oldest first).
        vouchers = self.voucher_repository.list_for_customer_fifo(
            db,
            customer.id,
            vehicle_id=vehicle_id,
            normalized_vehicle_number=norm_num,
        )

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
                if vehicle and voucher.vehicle_id is None:
                    voucher.vehicle_id = vehicle.id
                    db.add(voucher)

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

            # Log audit log
            self.audit_service.log_action(
                db,
                action="Received Payment (FIFO Allocation)",
                target_table="payments",
                target_id=str(payment.id),
                actor_id=actor_id,
                new_values={
                    "customer_id": str(customer.id),
                    "amount": str(total_allocated),
                    "payment_mode": payment_mode.value,
                    "payment_date": str(payment_date),
                    "reference_number": reference_number,
                    "remarks": payment.remarks,
                    "vehicle_id": str(vehicle.id) if vehicle else None,
                    "voucher_count": len(touched),
                }
            )

        db.refresh(payment)
        return payment
