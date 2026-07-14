from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.repositories.base_repository import BaseRepository
from app.models.employee import Employee


class EmployeeRepository(BaseRepository[Employee]):

    def __init__(self) -> None:
        super().__init__(Employee)

    # -----------------------------------
    # Get By UUID
    # -----------------------------------

    def get_by_uuid(
        self,
        db: Session,
        employee_uuid: str,
    ) -> Employee | None:

        return db.scalar(
            select(Employee).where(
                Employee.uuid == employee_uuid,
            )
        )

    # -----------------------------------
    # Get By Email
    # -----------------------------------

    def get_by_email(
        self,
        db: Session,
        email: str,
    ) -> Employee | None:

        return db.scalar(
            select(Employee).where(
                Employee.email == email,
            )
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
    ) -> tuple[list[Employee], int]:

        query = select(Employee).where(
            Employee.is_active.is_(True)
        )

        if search:

            pattern = f"%{search}%"

            query = query.where(
                or_(
                    Employee.full_name.ilike(pattern),
                    Employee.email.ilike(pattern),
                    Employee.phone.ilike(pattern),
                )
            )

        total = db.scalar(
            select(func.count()).select_from(
                query.subquery()
            )
        )

        query = (
            query
            .order_by(Employee.full_name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        employees = list(
            db.scalars(query).all()
        )

        return employees, total or 0