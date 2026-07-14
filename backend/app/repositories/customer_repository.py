from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.repositories.base_repository import BaseRepository
from app.models.customer import Customer


class CustomerRepository(
    BaseRepository[Customer]
):

    def __init__(self) -> None:
        super().__init__(Customer)

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        customer: Customer,
    ) -> Customer:

        db.add(customer)
        db.commit()
        db.refresh(customer)

        return customer

    # -----------------------------------
    # Update
    # -----------------------------------

    def update(
        self,
        db: Session,
        customer: Customer,
    ) -> Customer:

        db.commit()
        db.refresh(customer)

        return customer

    # -----------------------------------
    # Delete
    # -----------------------------------

    def delete(
        self,
        db: Session,
        customer: Customer,
    ) -> None:

        customer.is_active = False
        db.commit()

    # -----------------------------------
    # Get By UUID
    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        customer_uuid: str,
    ) -> Customer | None:

        return db.scalar(
            select(Customer).where(
                Customer.uuid == customer_uuid,
            )
        )

    # -----------------------------------
    # Get By Mobile
    # -----------------------------------

    def get_by_mobile(
        self,
        db: Session,
        mobile: str,
    ) -> Customer | None:

        return db.scalar(
            select(Customer).where(
                Customer.mobile == mobile,
            )
        )

    # -----------------------------------
    # Get By Code
    # -----------------------------------

    def get_by_code(
        self,
        db: Session,
        customer_code: str,
    ) -> Customer | None:

        return db.scalar(
            select(Customer).where(
                Customer.customer_code == customer_code,
            )
        )

    def get_by_gst(
        self,
        db: Session,
        gst_number: str,
    ) -> Customer | None:

        return db.scalar(
            select(Customer).where(
                Customer.gst_number == gst_number,
            )
        )

    # -----------------------------------
    # Get By Name (case-insensitive exact)
    # -----------------------------------

    def get_by_name(
        self,
        db: Session,
        name: str,
    ) -> Customer | None:
        """Match an existing active customer by an exact, case-insensitive
        name. Used to de-duplicate before auto-creating a customer from a
        voucher's free-text name."""

        return db.scalar(
            select(Customer)
            .where(
                Customer.is_active.is_(True),
                func.lower(Customer.name) == name.strip().lower(),
            )
            .order_by(Customer.id)
        )

    # -----------------------------------
    # Search + Pagination
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:

        query = select(Customer).where(
            Customer.is_active.is_(True)
        )

        if search:

            pattern = f"%{search}%"

            query = query.where(
                or_(
                    Customer.name.ilike(pattern),
                    Customer.mobile.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.gst_number.ilike(pattern),
                )
            )

        total = db.scalar(
            select(func.count()).select_from(
                query.subquery()
            )
        )

        query = (
            query
            .order_by(Customer.name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        customers = list(
            db.scalars(query).all()
        )

        return customers, total or 0