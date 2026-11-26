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

    def _validate_unique_fields(
        self,
        db: Session,
        *,
        customer_code: str | None = None,
        mobile: str | None = None,
        gst_number: str | None = None,
        current_customer: Customer | None = None,
    ) -> None:
        """Ensure customer_code, mobile, and gst_number are not already taken."""
        checks = (
            ("customer_code", customer_code, self.repository.get_by_code, DuplicateCustomerCodeError),
            ("mobile", mobile, self.repository.get_by_mobile, DuplicateCustomerPhoneError),
            ("gst_number", gst_number, self.repository.get_by_gst, DuplicateCustomerGSTError),
        )
        for field_name, value, lookup_fn, error_cls in checks:
            if not value:
                continue
            if current_customer is not None and value == getattr(current_customer, field_name):
                continue
            if lookup_fn(db, value):
                raise error_cls(value)

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: CustomerCreate,
        actor_id: int | None = None,
    ) -> Customer:

        self._validate_unique_fields(
            db,
            customer_code=data.customer_code,
            mobile=data.mobile,
            gst_number=data.gst_number,
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

        self._validate_unique_fields(
            db,
            customer_code=update_data.get("customer_code"),
            mobile=update_data.get("mobile"),
            gst_number=update_data.get("gst_number"),
            current_customer=customer,
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

    # -----------------------------------
    # Risk & Collection Scoring + Duplicate Merge
    # -----------------------------------

    def get_risk_scores(self, db: Session) -> list[dict]:
        from datetime import date
        from sqlalchemy import func, select
        from app.core.enums import PaymentStatus
        from app.models.customer import Customer
        from app.models.voucher import Voucher

        today = date.today()
        customers = list(
            db.scalars(select(Customer).where(Customer.is_active.is_(True))).all()
        )
        oldest_rows = db.execute(
            select(
                Voucher.customer_id,
                func.min(Voucher.invoice_date),
            )
            .where(
                Voucher.is_active.is_(True),
                Voucher.customer_id.isnot(None),
                Voucher.payment_status.in_([PaymentStatus.UNPAID, PaymentStatus.PARTIAL]),
            )
            .group_by(Voucher.customer_id)
        ).all()
        oldest_map = {cid: dt for cid, dt in oldest_rows if dt is not None}

        results: list[dict] = []
        for c in customers:
            bal = float(c.outstanding_balance or 0)
            limit = float(c.credit_limit or 0)
            oldest_dt = oldest_map.get(c.id)
            overdue_days = (today - oldest_dt).days if (oldest_dt and bal > 1) else 0

            if (overdue_days > 30 and bal > 1) or (limit > 0 and bal > limit):
                risk = "RED"
                stage = "SOFT_HOLD"
            elif overdue_days >= 15 and bal > 1:
                risk = "AMBER"
                stage = "DAY_15_REMINDER"
            else:
                risk = "GREEN"
                stage = "CURRENT"

            results.append(
                {
                    "customer_uuid": str(c.uuid),
                    "name": c.name,
                    "mobile": c.mobile,
                    "outstanding_balance": round(bal, 2),
                    "credit_limit": round(limit, 2),
                    "overdue_days": overdue_days,
                    "risk_score": risk,
                    "collection_stage": stage,
                }
            )

        priority = {"RED": 0, "AMBER": 1, "GREEN": 2}
        results.sort(key=lambda r: (priority[r["risk_score"]], -r["outstanding_balance"]))
        return results

    def find_duplicates(self, db: Session) -> list[dict]:
        import re
        from sqlalchemy import select
        from app.models.customer import Customer

        customers = list(
            db.scalars(select(Customer).where(Customer.is_active.is_(True))).all()
        )

        def _norm(s: str) -> str:
            s = re.sub(r"[^a-z0-9]", "", s.lower())
            for suffix in ("transport", "trpt", "travels", "logistics", "pvt", "ltd"):
                s = s.replace(suffix, "")
            return s

        groups: dict[str, list[Customer]] = {}
        for c in customers:
            key = _norm(c.name)
            if len(key) >= 3:
                groups.setdefault(key, []).append(c)

        dupes: list[dict] = []
        for key, items in groups.items():
            if len(items) > 1:
                dupes.append(
                    {
                        "key": key,
                        "customers": [
                            {
                                "uuid": str(c.uuid),
                                "name": c.name,
                                "mobile": c.mobile,
                                "outstanding_balance": float(c.outstanding_balance or 0),
                            }
                            for c in items
                        ],
                    }
                )
        return dupes

    def merge_customers(
        self,
        db: Session,
        *,
        source_uuid: str,
        target_uuid: str,
        actor_id: int | None = None,
    ) -> dict:
        from sqlalchemy import update
        from app.models.ledger_entry import LedgerEntry
        from app.models.payment import Payment
        from app.models.vehicle import Vehicle
        from app.models.voucher import Voucher

        if source_uuid == target_uuid:
            raise ValueError("Source and target customers must be different.")
        source = self.repository.get_by_uuid(db, source_uuid)
        target = self.repository.get_by_uuid(db, target_uuid)
        if not source or not target:
            raise CustomerNotFoundError(source_uuid if not source else target_uuid)

        db.execute(
            update(Voucher).where(Voucher.customer_id == source.id).values(customer_id=target.id)
        )
        db.execute(
            update(Payment).where(Payment.customer_id == source.id).values(customer_id=target.id)
        )
        db.execute(
            update(Vehicle).where(Vehicle.customer_id == source.id).values(customer_id=target.id)
        )
        db.execute(
            update(LedgerEntry).where(LedgerEntry.customer_id == source.id).values(customer_id=target.id)
        )

        target.opening_balance = (target.opening_balance or 0) + (source.opening_balance or 0)
        target.outstanding_balance = (target.outstanding_balance or 0) + (source.outstanding_balance or 0)
        source.is_active = False

        self.audit_service.log_action(
            db,
            action="Merged Duplicate Customer",
            target_table="customers",
            target_id=str(target.uuid),
            actor_id=actor_id,
            new_values={"merged_from": str(source.uuid), "source_name": source.name},
        )
        db.commit()
        return {
            "merged": True,
            "target_uuid": str(target.uuid),
            "target_name": target.name,
            "new_outstanding_balance": float(target.outstanding_balance or 0),
        }