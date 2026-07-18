from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.voucher import Voucher
from app.models.customer import Customer
from app.repositories.base_repository import BaseRepository


class VoucherRepository(BaseRepository[Voucher]):
    SORT_FIELDS = {
        "invoice_date": Voucher.invoice_date,
        "invoice_number": Voucher.invoice_number,
        "customer_name": Voucher.customer_name,
        "vehicle_number": Voucher.vehicle_number,
        "fuel_type": Voucher.fuel_type,
        "payment_mode": Voucher.payment_mode,
        "total_amount": Voucher.total_amount,
        "created_at": Voucher.created_at,
        "updated_at": Voucher.updated_at,
    }

    def __init__(self):
        super().__init__(Voucher)

    def get_by_uuid(
        self,
        db: Session,
        voucher_uuid: str,
    ) -> Voucher | None:

        statement = (
            select(Voucher)
            .where(Voucher.uuid == voucher_uuid)
            .options(
                joinedload(Voucher.customer),
                joinedload(Voucher.vehicle),
            )
        )

        return db.scalar(statement)

    def get_by_invoice(
        self,
        db: Session,
        invoice_number: str,
    ) -> Voucher | None:

        statement = (
            select(Voucher)
            .where(
                Voucher.invoice_number == invoice_number
            )
        )

        return db.scalar(statement)

    def list_for_customer(
        self,
        db: Session,
        customer_id: int,
        *,
        payment_statuses: list[str] | None = None,
    ) -> list[Voucher]:
        """Return a customer's vouchers, newest first. Optionally restrict
        to given payment statuses (e.g. UNPAID + PARTIAL for the settle
        flow). Ordered oldest-first is done by callers that need it."""

        statement = (
            select(Voucher)
            .where(
                Voucher.customer_id == customer_id,
                Voucher.is_active.is_(True),
            )
            .options(joinedload(Voucher.customer))
        )

        if payment_statuses:
            statement = statement.where(
                Voucher.payment_status.in_(payment_statuses)
            )

        statement = statement.order_by(
            desc(Voucher.invoice_date),
            desc(Voucher.id),
        )

        return list(db.scalars(statement).all())

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

        statement = select(Voucher).options(
            joinedload(Voucher.customer),
            joinedload(Voucher.vehicle),
        )

        # -------------------------
        # Search
        # -------------------------

        if search:
            search_term = f"%{search}%"

            statement = statement.where(
                or_(
                    Voucher.invoice_number.ilike(search_term),
                    Voucher.customer_name.ilike(search_term),
                    Voucher.vehicle_number.ilike(search_term),
                )
            )

        # -------------------------
        # Filters
        # -------------------------

        if fuel_type:
            types = [t.strip() for t in fuel_type.split(",") if t.strip()]
            if types:
                statement = statement.where(Voucher.fuel_type.in_(types))

        if payment_mode:
            modes = [m.strip() for m in payment_mode.split(",") if m.strip()]
            if modes:
                statement = statement.where(Voucher.payment_mode.in_(modes))

        if payment_status:
            statement = statement.where(
                Voucher.payment_status == payment_status
            )

        if customer_uuid:
            statement = statement.join(Voucher.customer).where(
                Customer.uuid == customer_uuid
            )

        if verification_status:
            statuses = [s.strip() for s in verification_status.split(",") if s.strip()]
            if statuses:
                statement = statement.where(Voucher.verification_status.in_(statuses))

        if from_date:
            statement = statement.where(
                Voucher.invoice_date >= from_date
            )

        if to_date:
            statement = statement.where(
                Voucher.invoice_date <= to_date
            )

        # Time-of-save filters (based on created_at — wall-clock timestamp)
        if from_datetime:
            statement = statement.where(
                Voucher.created_at >= from_datetime
            )

        if to_datetime:
            statement = statement.where(
                Voucher.created_at <= to_datetime
            )

        # -------------------------
        # Total Count
        # -------------------------

        count_statement = (
            select(func.count())
            .select_from(statement.subquery())
        )

        total = db.scalar(count_statement) or 0

        # -------------------------
        # Sorting
        # -------------------------

        sort_column = self.SORT_FIELDS.get(
            sort_by,
            Voucher.invoice_date,
        )

        if sort_order.lower() == "asc":
            statement = statement.order_by(
                asc(sort_column)
            )
        else:
            statement = statement.order_by(
                desc(sort_column)
            )

        # -------------------------
        # Pagination
        # -------------------------

        statement = statement.offset(
            (page - 1) * page_size
        ).limit(page_size)

        items = list(
            db.scalars(statement).all()
        )

        return items, total

    def update(
        self,
        db: Session,
        voucher: Voucher,
    ) -> Voucher:

        db.commit()
        db.refresh(voucher)

        return voucher

    def list_for_customer_fifo(
        self,
        db: Session,
        customer_id: int,
        vehicle_id: int | None = None,
        normalized_vehicle_number: str | None = None,
    ) -> list[Voucher]:
        """Return customer's active vouchers with balance due, oldest first
        (FIFO). When ``vehicle_id`` or ``normalized_vehicle_number`` is given,
        restrict to that vehicle's vouchers so a payment can be scoped to a
        single vehicle."""
        from app.core.enums import PaymentStatus
        from app.common.normalization import normalize_vehicle_number

        statement = (
            select(Voucher)
            .where(
                Voucher.customer_id == customer_id,
                Voucher.is_active.is_(True),
                Voucher.payment_status.in_([PaymentStatus.UNPAID, PaymentStatus.PARTIAL]),
            )
            .order_by(Voucher.invoice_date.asc(), Voucher.id.asc())
            .options(joinedload(Voucher.customer))
        )

        vouchers = list(db.scalars(statement).all())

        if vehicle_id is not None or normalized_vehicle_number:
            filtered = []
            for v in vouchers:
                if vehicle_id is not None and v.vehicle_id == vehicle_id:
                    filtered.append(v)
                elif normalized_vehicle_number and normalize_vehicle_number(v.vehicle_number) == normalized_vehicle_number:
                    filtered.append(v)
            return filtered

        return vouchers

    def list_for_vehicle(
        self,
        db: Session,
        vehicle_id: int,
    ) -> list[Voucher]:
        """All active vouchers tagged with a vehicle, newest first — the
        vehicle-ledger equivalent of ``list_for_customer``."""

        statement = (
            select(Voucher)
            .where(
                Voucher.vehicle_id == vehicle_id,
                Voucher.is_active.is_(True),
            )
            .order_by(desc(Voucher.invoice_date), desc(Voucher.id))
            .options(
                joinedload(Voucher.customer),
                joinedload(Voucher.vehicle),
            )
        )
        return list(db.scalars(statement).all())

    def outstanding_for_vehicle(
        self,
        db: Session,
        vehicle_id: int,
    ) -> Decimal:
        """Live vehicle outstanding = SUM(balance_due) over the vehicle's
        active vouchers. ``balance_due`` is total_amount − amount_paid floored
        at 0, so paid/cash vouchers contribute nothing. Computed in SQL so it
        always agrees with the customer view over the same rows."""

        raw_due = Voucher.total_amount - Voucher.amount_paid
        # Floor each voucher's balance at zero (portable across SQLite/Postgres,
        # unlike two-arg MAX/GREATEST) so overpaid vouchers can't net negative.
        due = case((raw_due > 0, raw_due), else_=0)

        total = db.scalar(
            select(func.coalesce(func.sum(due), 0)).where(
                Voucher.vehicle_id == vehicle_id,
                Voucher.is_active.is_(True),
            )
        )
        return Decimal(str(total or "0.00"))

    def outstanding_for_vehicles(
        self,
        db: Session,
        vehicle_ids: list[int],
    ) -> dict[int, Decimal]:
        """Bulk version of ``outstanding_for_vehicle`` — one grouped query for
        a page of vehicles so the list view avoids an N+1. Missing ids (no
        vouchers) default to 0.00."""

        if not vehicle_ids:
            return {}

        raw_due = Voucher.total_amount - Voucher.amount_paid
        due = case((raw_due > 0, raw_due), else_=0)

        rows = db.execute(
            select(
                Voucher.vehicle_id,
                func.coalesce(func.sum(due), 0),
            )
            .where(
                Voucher.vehicle_id.in_(vehicle_ids),
                Voucher.is_active.is_(True),
            )
            .group_by(Voucher.vehicle_id)
        ).all()

        totals = {vid: Decimal(str(total or "0.00")) for vid, total in rows}
        return {
            vid: totals.get(vid, Decimal("0.00")) for vid in vehicle_ids
        }