from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.core.enums import LedgerEntryType
from app.models.customer import Customer
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
)
from app.services.ledger_service import LedgerService
from app.services.balance_service import BalanceService
from app.services.audit_log_service import AuditLogService
from app.core.exceptions import (
    CustomerNotFoundError,
    DuplicateCustomerGSTError,
    DuplicateCustomerPhoneError,
    DuplicateCustomerCodeError,
)


class CustomerService:

    def __init__(self) -> None:
        self.repository = CustomerRepository()
        self.ledger_service = LedgerService()
        self.balance_service = BalanceService()
        self.audit_service = AuditLogService()

    def _apply_live_balance(
        self,
        db: Session,
        customer: Customer,
    ) -> Customer:
        """Overwrite the transient ``outstanding_balance`` with the live value
        computed from the ledger, so every serializer reports the authoritative
        figure regardless of the cached column. Assigning to the mapped
        attribute here does not persist — callers of read paths never commit."""
        customer.outstanding_balance = (
            self.balance_service.customer_outstanding(db, customer.id)
        )
        return customer

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: CustomerCreate,
        actor_id: int | None = None,
    ) -> Customer:

        if data.customer_code:
            existing = self.repository.get_by_code(
                db,
                data.customer_code,
            )

            if existing:
                raise DuplicateCustomerCodeError(
                    data.customer_code,
                )

        if data.mobile:
            existing = self.repository.get_by_mobile(
                db,
                data.mobile,
            )

            if existing:
                raise DuplicateCustomerPhoneError(
                    data.mobile,
                )

        if data.gst_number:
            existing = self.repository.get_by_gst(
                db,
                data.gst_number,
            )

            if existing:
                raise DuplicateCustomerGSTError(
                    data.gst_number,
                )

        customer_data = data.model_dump()

        # The ledger is the source of truth for balance. The customer row
        # starts at zero; the OPENING_BALANCE ledger entry (below) sets it.
        customer_data["outstanding_balance"] = Decimal("0.00")

        customer = Customer(**customer_data)

        customer = self.repository.create(
            db,
            customer,
        )

        if customer.customer_code is None:
            customer.customer_code = (
                f"CUST{customer.id:06d}"
            )
            customer = self.repository.update(
                db,
                customer,
            )

        # Seed the opening balance as the first ledger entry.
        if customer.opening_balance and customer.opening_balance != Decimal("0.00"):
            self.ledger_service.post(
                db,
                customer,
                LedgerEntryType.OPENING_BALANCE,
                customer.opening_balance,
                entry_date=date.today(),
                reference_type="CUSTOMER",
                reference_id=customer.id,
                remarks="Opening balance",
            )

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Created Customer",
            target_table="customers",
            target_id=str(customer.id),
            actor_id=actor_id,
            new_values={
                "name": customer.name,
                "customer_code": customer.customer_code,
                "mobile": customer.mobile,
                "gst_number": customer.gst_number,
                "address": customer.address,
                "opening_balance": str(customer.opening_balance) if customer.opening_balance else "0.00",
            }
        )

        return customer

    def get_by_uuid(
        self,
        db: Session,
        customer_uuid: str,
    ) -> Customer:
        customer = self.repository.get_by_uuid(
            db,
            customer_uuid,
        )

        if customer is None:
            raise CustomerNotFoundError(
                customer_uuid,
            )

        return self._apply_live_balance(db, customer)

    def search(
        self,
        db: Session,
        *,
        search: str | None = None,
        balance_filter: str | None = None,
        sort_by: str | None = "name",
        from_date: Any | None = None,
        to_date: Any | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:
        customers, total = self.repository.search(
            db,
            search=search,
            balance_filter=balance_filter,
            sort_by=sort_by,
            from_date=from_date,
            to_date=to_date,
            page=page,
            page_size=page_size,
        )
        return [self._apply_live_balance(db, c) for c in customers], total

    def search_autocomplete(
        self,
        db: Session,
        *,
        search: str,
        limit: int = 10,
    ) -> list[Customer]:
        customers = self.repository.search_autocomplete(
            db,
            search=search,
            limit=limit,
        )
        return [self._apply_live_balance(db, c) for c in customers]

    # -----------------------------------
    # Update
    # -----------------------------------

    def update(
        self,
        db: Session,
        customer_uuid: str,
        data: CustomerUpdate,
        actor_id: int | None = None,
    ) -> Customer:

        customer = self.repository.get_by_uuid(
            db,
            customer_uuid,
        )

        if customer is None:
            raise CustomerNotFoundError(
                customer_uuid,
            )

        update_data = data.model_dump(
            exclude_unset=True,
        )

        old_values = {
            "name": customer.name,
            "customer_code": customer.customer_code,
            "mobile": customer.mobile,
            "gst_number": customer.gst_number,
            "address": customer.address,
            "opening_balance": str(customer.opening_balance) if customer.opening_balance else "0.00",
        }

        # Duplicate Mobile
        if (
            "mobile" in update_data
            and update_data["mobile"]
            and update_data["mobile"] != customer.mobile
        ):

            existing = self.repository.get_by_mobile(
                db,
                update_data["mobile"],
            )

            if existing:
                raise DuplicateCustomerPhoneError(
                    update_data["mobile"],
                )

        # Duplicate GST
        if (
            "gst_number" in update_data
            and update_data["gst_number"]
            and update_data["gst_number"] != customer.gst_number
        ):

            existing = self.repository.get_by_gst(
                db,
                update_data["gst_number"],
            )

            if existing:
                raise DuplicateCustomerGSTError(
                    update_data["gst_number"],
                )

        # Duplicate Customer Code
        if (
            "customer_code" in update_data
            and update_data["customer_code"]
            and update_data["customer_code"] != customer.customer_code
        ):

            existing = self.repository.get_by_code(
                db,
                update_data["customer_code"],
            )

            if existing:
                raise DuplicateCustomerCodeError(
                    update_data["customer_code"],
                )

        # An opening-balance change is posted as a ledger adjustment for
        # the delta (the ledger is the single balance writer), NOT by
        # mutating outstanding_balance directly.
        balance_delta = Decimal("0.00")
        if "opening_balance" in update_data:
            balance_delta = (
                update_data["opening_balance"]
                - customer.opening_balance
            )

        for field, value in update_data.items():
            setattr(
                customer,
                field,
                value,
            )

        customer = self.repository.update(
            db,
            customer,
        )

        if balance_delta != Decimal("0.00"):
            entry_type = (
                LedgerEntryType.DEBIT_ADJUSTMENT
                if balance_delta > 0
                else LedgerEntryType.CREDIT_ADJUSTMENT
            )
            self.ledger_service.post(
                db,
                customer,
                entry_type,
                abs(balance_delta),
                entry_date=date.today(),
                reference_type="CUSTOMER",
                reference_id=customer.id,
                remarks="Opening balance adjustment",
            )

        # Log audit log
        new_values = {
            "name": customer.name,
            "customer_code": customer.customer_code,
            "mobile": customer.mobile,
            "gst_number": customer.gst_number,
            "address": customer.address,
            "opening_balance": str(customer.opening_balance) if customer.opening_balance else "0.00",
        }
        self.audit_service.log_action(
            db,
            action="Updated Customer",
            target_table="customers",
            target_id=str(customer.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values=new_values,
        )

        return customer

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        customer_uuid: str,
        actor_id: int | None = None,
    ) -> None:

        customer = self.repository.get_by_uuid(
            db,
            customer_uuid,
        )

        if customer is None:
            raise CustomerNotFoundError(
                customer_uuid,
            )

        old_values = {
            "name": customer.name,
            "customer_code": customer.customer_code,
            "mobile": customer.mobile,
            "gst_number": customer.gst_number,
            "address": customer.address,
            "opening_balance": str(customer.opening_balance) if customer.opening_balance else "0.00",
        }

        self.repository.delete(
            db,
            customer,
        )

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Customer",
            target_table="customers",
            target_id=str(customer.id),
            actor_id=actor_id,
            old_values=old_values,
        )