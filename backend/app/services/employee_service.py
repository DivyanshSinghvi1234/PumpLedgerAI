from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
)
from app.core.exceptions import (
    EmployeeNotFoundError,
    DuplicateEmployeeEmailError,
)
from app.services.audit_log_service import AuditLogService


class EmployeeService:

    def __init__(self) -> None:
        self.repository = EmployeeRepository()
        self.audit_service = AuditLogService()

    # -----------------------------------
    # Create
    # -----------------------------------

    def create(
        self,
        db: Session,
        data: EmployeeCreate,
        actor_id: int | None = None,
    ) -> Employee:

        if data.email:
            existing = self.repository.get_by_email(
                db,
                data.email,
            )

            if existing:
                raise DuplicateEmployeeEmailError(
                    data.email,
                )

        employee = Employee(**data.model_dump())

        employee = self.repository.create(
            db,
            employee,
        )

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Created Employee",
            target_table="employees",
            target_id=str(employee.id),
            actor_id=actor_id,
            new_values={
                "full_name": employee.full_name,
                "email": employee.email,
                "phone": employee.phone,
                "role": employee.role,
                "is_active": employee.is_active,
            }
        )

        return employee

    # -----------------------------------
    # Get All (active only)
    # -----------------------------------

    def get_all_active(
        self,
        db: Session,
    ) -> list[Employee]:

        return db.scalars(
            select(Employee).where(Employee.is_active == True)
        ).all()

    # -----------------------------------
    # Get All
    # -----------------------------------

    def get_all(
        self,
        db: Session,
    ) -> list[Employee]:

        return self.repository.get_all(db)

    # -----------------------------------
    # Search
    # -----------------------------------

    def search(
        self,
        db: Session,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Employee], int]:

        return self.repository.search(
            db,
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
        employee_uuid: str,
    ) -> Employee:

        employee = self.repository.get_by_uuid(
            db,
            employee_uuid,
        )

        if employee is None:
            raise EmployeeNotFoundError(
                employee_uuid,
            )

        return employee

    # -----------------------------------
    # Update
    # -----------------------------------

    def update(
        self,
        db: Session,
        employee_uuid: str,
        data: EmployeeUpdate,
        actor_id: int | None = None,
    ) -> Employee:

        employee = self.repository.get_by_uuid(
            db,
            employee_uuid,
        )

        if employee is None:
            raise EmployeeNotFoundError(
                employee_uuid,
            )

        old_values = {
            "full_name": employee.full_name,
            "email": employee.email,
            "phone": employee.phone,
            "role": employee.role,
            "is_active": employee.is_active,
        }

        update_data = data.model_dump(
            exclude_unset=True,
        )

        # Duplicate Email check
        if (
            "email" in update_data
            and update_data["email"]
            and update_data["email"] != employee.email
        ):

            existing = self.repository.get_by_email(
                db,
                update_data["email"],
            )

            if existing:
                raise DuplicateEmployeeEmailError(
                    update_data["email"],
                )

        for field, value in update_data.items():
            setattr(
                employee,
                field,
                value,
            )

        employee = self.repository.update(
            db,
            employee,
        )

        # Log audit log
        new_values = {
            "full_name": employee.full_name,
            "email": employee.email,
            "phone": employee.phone,
            "role": employee.role,
            "is_active": employee.is_active,
        }
        self.audit_service.log_action(
            db,
            action="Updated Employee",
            target_table="employees",
            target_id=str(employee.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values=new_values,
        )

        return employee

    # -----------------------------------
    # Delete (Soft Delete)
    # -----------------------------------

    def delete(
        self,
        db: Session,
        employee_uuid: str,
        actor_id: int | None = None,
    ) -> None:

        employee = self.repository.get_by_uuid(
            db,
            employee_uuid,
        )

        if employee is None:
            raise EmployeeNotFoundError(
                employee_uuid,
            )

        old_values = {
            "full_name": employee.full_name,
            "email": employee.email,
            "phone": employee.phone,
            "role": employee.role,
            "is_active": employee.is_active,
        }

        self.repository.delete(
            db,
            employee,
        )

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Deleted Employee",
            target_table="employees",
            target_id=str(employee.id),
            actor_id=actor_id,
            old_values=old_values,
        )