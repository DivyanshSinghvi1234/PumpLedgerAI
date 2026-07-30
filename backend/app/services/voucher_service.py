from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType, PaymentMode, PaymentStatus
from app.core.exceptions import (
    CustomerNotFoundError,
    DuplicateInvoiceError,
    VoucherNotFoundError,
)
from app.core.enums import VerificationStatus
from app.common.normalization import normalize_vehicle_number
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.voucher import Voucher
from app.repositories.customer_repository import CustomerRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.repositories.voucher_repository import VoucherRepository
from app.schemas.voucher import (
    VoucherCreate,
    VoucherUpdate,
)
from app.services.ledger_service import LedgerService
from app.services.fuel_tank_service import FuelTankService
from app.services.audit_log_service import AuditLogService


class VoucherService:
    def __init__(self):
        self.repository = VoucherRepository()
        self.customer_repository = CustomerRepository()
        self.vehicle_repository = VehicleRepository()
        self.ledger_service = LedgerService()
        self.tank_service = FuelTankService()
        self.audit_service = AuditLogService()

    # -----------------------------------
    # Helpers
    # -----------------------------------

    def _resolve_customer(
        self,
        db: Session,
        customer_uuid,
    ):
        """Resolve an optional customer_uuid to a Customer (or None)."""
        if customer_uuid is None:
            return None

        customer = self.customer_repository.get_by_uuid(
            db,
            str(customer_uuid),
        )

        if customer is None:
            raise CustomerNotFoundError(str(customer_uuid))

        return customer

    def _link_or_create_customer(
        self,
        db: Session,
        customer_uuid,
        customer_name: str | None,
    ):
        """Resolve the customer a voucher should link to.

        Priority:
          1. An explicit ``customer_uuid`` (chosen from the autocomplete).
          2. An existing active customer whose name matches the free-text
             ``customer_name`` (case-insensitive exact) — reuse it.
          3. Otherwise, auto-create a minimal customer from the name so the
             master list stays complete and future vouchers can match it.

        Returns ``None`` only for a walk-in with no name at all.
        """
        if customer_uuid is not None:
            return self._resolve_customer(db, customer_uuid)

        name = (customer_name or "").strip()
        if not name:
            return None

        existing = self.customer_repository.get_by_name(db, name)
        if existing is not None:
            return existing

        # Auto-create a minimal customer. Its code is backfilled to
        # ``CUST{id:06d}`` the same way CustomerService.create does.
        customer = self.customer_repository.create(
            db,
            Customer(name=name),
        )

        if customer.customer_code is None:
            customer.customer_code = f"CUST{customer.id:06d}"
            customer = self.customer_repository.update(db, customer)

        return customer

    def _link_or_create_vehicle(
        self,
        db: Session,
        customer: Customer | None,
        vehicle_number: str | None,
    ) -> Vehicle | None:
        """Resolve the vehicle a voucher should link to.

        Mirrors ``_link_or_create_customer``: the plate is normalized, matched
        against existing vehicles, and otherwise created. A vehicle always
        belongs to a customer, so this only runs once a customer has been
        resolved/created — a plate on a customer-less walk-in stays as the
        free-text ``vehicle_number`` only.

        Returns ``None`` when there is no customer or no usable plate.
        """
        if customer is None:
            return None

        normalized = normalize_vehicle_number(vehicle_number)
        if not normalized:
            return None

        existing = self.vehicle_repository.get_by_normalized(db, normalized)
        if existing is not None:
            return existing

        vehicle = self.vehicle_repository.create(
            db,
            Vehicle(
                customer_id=customer.id,
                vehicle_number=(vehicle_number or "").strip(),
                normalized_number=normalized,
            ),
        )
        return vehicle

    @staticmethod
    def _affects_ledger(voucher: Voucher) -> bool:
        """A voucher posts to the ledger if it is linked to a customer."""
        return voucher.customer_id is not None

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: VoucherCreate,
        actor_id: int | None = None,
    ) -> Voucher:

        existing = self.repository.get_by_invoice(
            db,
            data.invoice_number,
        )

        if existing:
            raise DuplicateInvoiceError(
                data.invoice_number,
            )

        customer = self._link_or_create_customer(
            db,
            data.customer_uuid,
            data.customer_name,
        )

        # Resolve/create the vehicle under that customer so the voucher links
        # into the vehicle's ledger. Keeps the free-text vehicle_number too.
        vehicle = self._link_or_create_vehicle(
            db,
            customer,
            data.vehicle_number,
        )

        total = data.total_amount

        from app.models.voucher_item import VoucherItem

        voucher = Voucher(
            **data.model_dump(
                exclude={"customer_uuid", "items"},
            ),
            customer_id=customer.id if customer else None,
            vehicle_id=vehicle.id if vehicle else None,
            verification_status=VerificationStatus.VERIFIED,
            pump_id=getattr(customer, "pump_id", None) if customer else 1,
        )


        voucher.items = [
            VoucherItem(
                fuel_type=item.fuel_type,
                quantity_liters=item.quantity_liters,
                rate_per_liter=item.rate_per_liter,
                total_amount=item.total_amount,
            )
            for item in data.items
        ]

        if data.items:
            voucher.fuel_type = data.items[0].fuel_type
            voucher.quantity_liters = data.items[0].quantity_liters
            voucher.rate_per_liter = data.items[0].rate_per_liter

        # Seed settlement state: cash/UPI/card sales are paid on the spot;
        # a CREDIT sale starts fully unpaid; a SPLIT sale allocates cash/UPI/card/credit.
        if voucher.payment_mode == PaymentMode.CREDIT:
            voucher.amount_paid = Decimal("0.00")
            voucher.payment_status = PaymentStatus.UNPAID
        elif voucher.payment_mode == PaymentMode.SPLIT:
            paid_portion = (
                (voucher.cash_amount or Decimal("0.00"))
                + (voucher.upi_amount or Decimal("0.00"))
                + (voucher.card_amount or Decimal("0.00"))
            )
            credit_portion = voucher.credit_amount or Decimal("0.00")
            voucher.amount_paid = paid_portion
            if credit_portion <= Decimal("0.00"):
                voucher.payment_status = PaymentStatus.PAID
            elif paid_portion <= Decimal("0.00"):
                voucher.payment_status = PaymentStatus.UNPAID
            else:
                voucher.payment_status = PaymentStatus.PARTIAL
        else:
            voucher.amount_paid = data.total_amount
            voucher.payment_status = PaymentStatus.PAID

        # Any voucher linked to a customer is posted to the ledger.
        if customer is not None:
            db.add(voucher)
            db.flush()

            if voucher.payment_mode == PaymentMode.CREDIT:
                self.ledger_service.post(
                    db,
                    customer,
                    LedgerEntryType.VOUCHER,
                    total,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Credit sale — invoice {voucher.invoice_number}",
                    extra_objects=[voucher],
                    actor_id=actor_id,
                )
            elif voucher.payment_mode == PaymentMode.SPLIT:
                # Post full debit for the split sale
                self.ledger_service.post(
                    db,
                    customer,
                    LedgerEntryType.VOUCHER,
                    total,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Split sale — invoice {voucher.invoice_number}",
                    extra_objects=[voucher],
                    actor_id=actor_id,
                )
                # Post offsetting immediate payment credits for non-credit portions
                if voucher.cash_amount and voucher.cash_amount > Decimal("0.00"):
                    self.ledger_service.post(
                        db,
                        customer,
                        LedgerEntryType.PAYMENT,
                        voucher.cash_amount,
                        entry_date=voucher.invoice_date,
                        reference_type="VOUCHER",
                        reference_id=voucher.id,
                        remarks=f"Immediate payment (Cash) — invoice {voucher.invoice_number}",
                        actor_id=actor_id,
                    )
                if voucher.upi_amount and voucher.upi_amount > Decimal("0.00"):
                    self.ledger_service.post(
                        db,
                        customer,
                        LedgerEntryType.PAYMENT,
                        voucher.upi_amount,
                        entry_date=voucher.invoice_date,
                        reference_type="VOUCHER",
                        reference_id=voucher.id,
                        remarks=f"Immediate payment (UPI) — invoice {voucher.invoice_number}",
                        actor_id=actor_id,
                    )
                if voucher.card_amount and voucher.card_amount > Decimal("0.00"):
                    self.ledger_service.post(
                        db,
                        customer,
                        LedgerEntryType.PAYMENT,
                        voucher.card_amount,
                        entry_date=voucher.invoice_date,
                        reference_type="VOUCHER",
                        reference_id=voucher.id,
                        remarks=f"Immediate payment (Card) — invoice {voucher.invoice_number}",
                        actor_id=actor_id,
                    )
            else:
                # For non-credit (CASH, CARD, UPI) vouchers linked to a customer,
                # post both the sale debit and the offsetting immediate payment credit
                # so it registers in the customer's ledger history but has a net effect of 0.
                self.ledger_service.post(
                    db,
                    customer,
                    LedgerEntryType.VOUCHER,
                    total,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Sale ({voucher.payment_mode.value}) — invoice {voucher.invoice_number}",
                    extra_objects=[voucher],
                    actor_id=actor_id,
                )
                self.ledger_service.post(
                    db,
                    customer,
                    LedgerEntryType.PAYMENT,
                    total,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Immediate payment ({voucher.payment_mode.value}) — invoice {voucher.invoice_number}",
                    actor_id=actor_id,
                )


            for item in voucher.items:
                self.tank_service.deduct_stock(db, item.fuel_type, item.quantity_liters)
            
            # Log audit log
            self.audit_service.log_action(
                db,
                action="Uploaded Invoice",
                target_table="vouchers",
                target_id=str(voucher.id),
                actor_id=actor_id,
                new_values={
                    "invoice_number": voucher.invoice_number,
                    "invoice_date": str(voucher.invoice_date),
                    "total_amount": str(voucher.total_amount),
                    "payment_mode": voucher.payment_mode.value,
                }
            )
            return voucher

        voucher = self.repository.create(
            db,
            voucher,
        )
        for item in voucher.items:
            self.tank_service.deduct_stock(db, item.fuel_type, item.quantity_liters)
        
        # Log audit log
        self.audit_service.log_action(
            db,
            action="Uploaded Invoice",
            target_table="vouchers",
            target_id=str(voucher.id),
            actor_id=actor_id,
            new_values={
                "invoice_number": voucher.invoice_number,
                "invoice_date": str(voucher.invoice_date),
                "total_amount": str(voucher.total_amount),
                "fuel_type": voucher.fuel_type.value,
                "quantity_liters": str(voucher.quantity_liters),
                "payment_mode": voucher.payment_mode.value,
            }
        )
        # Send credit alert if payment mode is credit
        if voucher.payment_mode == PaymentMode.CREDIT:
            try:
                from app.services.notification_service import NotificationService
                NotificationService().send_credit_alert(db, voucher)
            except Exception:
                pass

        return voucher

    # -----------------------------------
    # Search + Pagination
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        search: str | None = None,
        fuel_type: str | None = None,
        payment_mode: str | None = None,
        payment_status: str | None = None,
        customer_uuid: str | None = None,
        verification_status: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        from_datetime: datetime | None = None,
        to_datetime: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "invoice_date",
        sort_order: str = "desc",
    ) -> tuple[list[Voucher], int]:

        return self.repository.search(
            db=db,
            search=search,
            fuel_type=fuel_type,
            payment_mode=payment_mode,
            payment_status=payment_status,
            customer_uuid=customer_uuid,
            verification_status=verification_status,
            from_date=from_date,
            to_date=to_date,
            from_datetime=from_datetime,
            to_datetime=to_datetime,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_for_customer(
        self,
        db: Session,
        customer_uuid: str,
        *,
        payment_statuses: list[str] | None = None,
    ) -> list[Voucher]:
        """All vouchers for a customer (optionally filtered by payment
        status), used by the customer detail view and settle flow."""

        customer = self.customer_repository.get_by_uuid(db, customer_uuid)

        if customer is None:
            raise CustomerNotFoundError(customer_uuid)

        return self.repository.list_for_customer(
            db,
            customer.id,
            payment_statuses=payment_statuses,
        )

    # -----------------------------------
    # Get By UUID
    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        voucher_uuid: str,
    ) -> Voucher:

        voucher = self.repository.get_by_uuid(
            db,
            voucher_uuid,
        )

        if voucher is None:
            raise VoucherNotFoundError(
                voucher_uuid,
            )

        return voucher

    # -----------------------------------
    # Update
    # -----------------------------------

    def update(
        self,
        db: Session,
        voucher_uuid: str,
        data: VoucherUpdate,
        actor_id: int | None = None,
    ) -> Voucher:

        voucher = self.repository.get_by_uuid(
            db,
            voucher_uuid,
        )

        if voucher is None:
            raise VoucherNotFoundError(
                voucher_uuid,
            )

        # Store old stock configurations to restore
        old_items = list(voucher.items)
        old_fuel_type = voucher.fuel_type
        old_quantity = voucher.quantity_liters

        old_values = {
            "invoice_number": voucher.invoice_number,
            "invoice_date": str(voucher.invoice_date),
            "total_amount": str(voucher.total_amount),
            "payment_mode": voucher.payment_mode.value,
        }

        update_data = data.model_dump(
            exclude_unset=True,
        )

        # Reverse any existing ledger effect before mutating the voucher;
        # we re-post from the new state afterwards. This keeps the balance
        # correct across changes to amount / customer / payment_mode.
        if self._affects_ledger(voucher):
            self.ledger_service.reverse_reference(
                db,
                voucher.customer,
                "VOUCHER",
                voucher.id,
                actor_id=actor_id,
            )

        # Resolve a new customer link if provided.
        resolved_customer = (
            voucher.customer if voucher.customer_id is not None else None
        )
        if "customer_uuid" in update_data:
            resolved_customer = self._resolve_customer(
                db,
                update_data.pop("customer_uuid"),
            )
            voucher.customer_id = (
                resolved_customer.id if resolved_customer else None
            )

        # Re-resolve the vehicle link against the (possibly new) customer, so
        # editing a saved voucher to add a vehicle number — or moving it to
        # another customer — relinks it into the right vehicle ledger. A plate
        # is only linkable once the voucher has a customer.
        new_plate = update_data.get(
            "vehicle_number",
            voucher.vehicle_number,
        )
        vehicle = self._link_or_create_vehicle(
            db,
            resolved_customer,
            new_plate,
        )
        voucher.vehicle_id = vehicle.id if vehicle else None

        # Handle items list update explicitly
        items_updated = False
        if "items" in update_data:
            items_data = update_data.pop("items")
            items_updated = True
            
            # Restore stock of old items
            for item in old_items:
                self.tank_service.restore_stock(db, item.fuel_type, item.quantity_liters)
                
            voucher.items.clear()
            
            from app.models.voucher_item import VoucherItem
            voucher.items = [
                VoucherItem(
                    fuel_type=item.fuel_type,
                    quantity_liters=item.quantity_liters,
                    rate_per_liter=item.rate_per_liter,
                    total_amount=item.total_amount,
                )
                for item in items_data
            ]
            
            # Deduct stock of new items
            for item in voucher.items:
                self.tank_service.deduct_stock(db, item.fuel_type, item.quantity_liters)
                
            # Maintain legacy compatibility and grand total
            if voucher.items:
                voucher.fuel_type = voucher.items[0].fuel_type
                voucher.quantity_liters = voucher.items[0].quantity_liters
                voucher.rate_per_liter = voucher.items[0].rate_per_liter
                voucher.total_amount = sum(item.total_amount for item in voucher.items)

        for field, value in update_data.items():
            setattr(
                voucher,
                field,
                value,
            )

        if not items_updated and (
            ("quantity_liters" in update_data or "rate_per_liter" in update_data)
            and "total_amount" not in update_data
        ):
            voucher.total_amount = (
                Decimal(voucher.quantity_liters)
                * Decimal(voucher.rate_per_liter)
            ).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

        voucher = self.repository.update(
            db,
            voucher,
        )

        if not items_updated:
            self.tank_service.update_stock(
                db,
                old_fuel_type,
                old_quantity,
                voucher.fuel_type,
                voucher.quantity_liters,
            )

        # Re-post from the new state if it still affects the ledger.
        if self._affects_ledger(voucher):
            if voucher.payment_mode == PaymentMode.CREDIT:
                self.ledger_service.post(
                    db,
                    voucher.customer,
                    LedgerEntryType.VOUCHER,
                    voucher.total_amount,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Credit sale — invoice {voucher.invoice_number}",
                    actor_id=actor_id,
                )
            else:
                self.ledger_service.post(
                    db,
                    voucher.customer,
                    LedgerEntryType.VOUCHER,
                    voucher.total_amount,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Sale ({voucher.payment_mode.value}) — invoice {voucher.invoice_number}",
                    actor_id=actor_id,
                )
                self.ledger_service.post(
                    db,
                    voucher.customer,
                    LedgerEntryType.PAYMENT,
                    voucher.total_amount,
                    entry_date=voucher.invoice_date,
                    reference_type="VOUCHER",
                    reference_id=voucher.id,
                    remarks=f"Immediate payment ({voucher.payment_mode.value}) — invoice {voucher.invoice_number}",
                    actor_id=actor_id,
                )

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Verified Invoice",
            target_table="vouchers",
            target_id=str(voucher.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values={
                "invoice_number": voucher.invoice_number,
                "invoice_date": str(voucher.invoice_date),
                "total_amount": str(voucher.total_amount),
                "fuel_type": voucher.fuel_type.value,
                "quantity_liters": str(voucher.quantity_liters),
                "payment_mode": voucher.payment_mode.value,
            }
        )

        # Send credit alert if payment mode is credit
        if voucher.payment_mode == PaymentMode.CREDIT:
            try:
                from app.services.notification_service import NotificationService
                NotificationService().send_credit_alert(db, voucher)
            except Exception:
                pass

        return voucher

    # -----------------------------------
    # Verification status
    # -----------------------------------

    def set_status(
        self,
        db: Session,
        voucher_uuid: str,
        status: VerificationStatus,
        actor_id: int | None = None,
    ) -> Voucher:

        voucher = self.repository.get_by_uuid(
            db,
            voucher_uuid,
        )

        if voucher is None:
            raise VoucherNotFoundError(
                voucher_uuid,
            )

        old_status = voucher.verification_status
        voucher.verification_status = status

        voucher = self.repository.update(
            db,
            voucher,
        )

        # Log audit log
        action_label = "Verified Invoice" if status == VerificationStatus.VERIFIED else "Rejected Invoice"
        self.audit_service.log_action(
            db,
            action=action_label,
            target_table="vouchers",
            target_id=str(voucher.id),
            actor_id=actor_id,
            old_values={"verification_status": old_status.value},
            new_values={"verification_status": status.value},
        )

        # Send credit alert if payment mode is credit and verified
        if status == VerificationStatus.VERIFIED and voucher.payment_mode == PaymentMode.CREDIT:
            try:
                from app.services.notification_service import NotificationService
                NotificationService().send_credit_alert(db, voucher)
            except Exception:
                pass

        return voucher

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        voucher_uuid: str,
        actor_id: int | None = None,
    ) -> None:

        voucher = self.repository.get_by_uuid(
            db,
            voucher_uuid,
        )

        if voucher is None:
            raise VoucherNotFoundError(
                voucher_uuid,
            )

        # If it posted to the ledger, reverse the entry and delete the
        # voucher in one transaction; otherwise a plain delete.
        if self._affects_ledger(voucher):
            self.ledger_service.reverse_reference(
                db,
                voucher.customer,
                "VOUCHER",
                voucher.id,
                extra_deletes=[voucher],
                actor_id=actor_id,
            )
            for item in voucher.items:
                self.tank_service.restore_stock(db, item.fuel_type, item.quantity_liters)
            
            # Log audit log
            self.audit_service.log_action(
                db,
                action="Deleted Invoice",
                target_table="vouchers",
                target_id=str(voucher.id),
                actor_id=actor_id,
                old_values={
                    "invoice_number": voucher.invoice_number,
                    "invoice_date": str(voucher.invoice_date),
                    "total_amount": str(voucher.total_amount),
                    "payment_mode": voucher.payment_mode.value,
                }
            )
            return

        for item in voucher.items:
            self.tank_service.restore_stock(db, item.fuel_type, item.quantity_liters)
        self.repository.delete(
            db,
            voucher,
        )
        
        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Invoice",
            target_table="vouchers",
            target_id=str(voucher.id),
            actor_id=actor_id,
            old_values={
                "invoice_number": voucher.invoice_number,
                "invoice_date": str(voucher.invoice_date),
                "total_amount": str(voucher.total_amount),
                "payment_mode": voucher.payment_mode.value,
            }
        )
