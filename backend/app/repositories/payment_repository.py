from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.customer import Customer
from app.models.payment import Payment
from app.repositories.base_repository import BaseRepository


class PaymentRepository(BaseRepository[Payment]):

    def __init__(self) -> None:
        super().__init__(Payment)

    # -----------------------------------
    # Get By UUID
    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        payment_uuid: str,
    ) -> Payment | None:

        return db.scalar(
            select(Payment)
            .where(Payment.uuid == payment_uuid)
            .options(joinedload(Payment.customer))
        )

    # -----------------------------------
    # Search + Pagination
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

        # Join to Customer so we can filter by customer and eager-load
        # it for the embedded customer_name / customer_uuid.
        query = (
            select(Payment)
            .join(Payment.customer)
            .where(Payment.is_active.is_(True))
            .options(joinedload(Payment.customer))
        )

        if customer_uuid:
            query = query.where(
                Customer.uuid == customer_uuid
            )

        if search:

            pattern = f"%{search}%"

            query = query.where(
                or_(
                    Payment.reference_number.ilike(pattern),
                    Customer.name.ilike(pattern),
                )
            )

        total = db.scalar(
            select(func.count()).select_from(
                query.subquery()
            )
        )

        query = (
            query
            .order_by(Payment.payment_date.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        payments = list(
            db.scalars(query).all()
        )

        return payments, total or 0
