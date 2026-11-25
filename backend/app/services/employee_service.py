from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import IncomeKind, PaymentMode
from app.models.employee import Employee
from app.models.nozzle_reading import NozzleReading
from app.models.shift import Shift
from app.models.staff_ledger_entry import StaffLedgerEntry
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    StaffLedgerEntryCreate,
    StaffLedgerEntryResponse,
    StaffLedgerSummaryResponse,
    StaffPayrollPayRequest,
    StaffPayrollPayResponse,
    StaffPayrollPreviewResponse,
    StaffPayrollRow,
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

    # -----------------------------------
    # Staff Ledger (Advances, Loans, Shortages, Repayments)
    # -----------------------------------

    def _outstanding_balance(self, db: Session, employee_id: int) -> Decimal:
        val = db.scalar(
            select(func.coalesce(func.sum(StaffLedgerEntry.signed_amount), Decimal("0.00")))
            .where(StaffLedgerEntry.employee_id == employee_id)
        )
        return Decimal(str(val or "0.00"))

    def get_ledger(
        self,
        db: Session,
        employee_uuid: str,
    ) -> StaffLedgerSummaryResponse:
        employee = self.get_by_uuid(db, employee_uuid)
        entries = db.scalars(
            select(StaffLedgerEntry)
            .where(StaffLedgerEntry.employee_id == employee.id)
            .order_by(StaffLedgerEntry.entry_date.desc(), StaffLedgerEntry.id.desc())
        ).all()
        balance = self._outstanding_balance(db, employee.id)
        return StaffLedgerSummaryResponse(
            employee_uuid=str(employee.uuid),
            full_name=employee.full_name,
            role=employee.role,
            base_salary=employee.base_salary or Decimal("0.00"),
            commission_rate_per_liter=employee.commission_rate_per_liter or Decimal("0.0000"),
            outstanding_balance=balance,
            entries=[StaffLedgerEntryResponse.model_validate(e) for e in entries],
        )

    def record_ledger_entry(
        self,
        db: Session,
        employee_uuid: str,
        data: StaffLedgerEntryCreate,
        actor_id: int | None = None,
    ) -> StaffLedgerEntry:
        employee = self.get_by_uuid(db, employee_uuid)
        # Positive = employee owes pump; Negative = reduces balance
        is_debit = data.entry_type in {"ADVANCE", "LOAN", "SHORTAGE"}
        signed = data.amount if is_debit else -data.amount

        entry = StaffLedgerEntry(
            employee_id=employee.id,
            entry_date=data.entry_date,
            entry_type=data.entry_type,
            amount=data.amount,
            signed_amount=signed,
            remarks=data.remarks,
            pump_id=employee.pump_id,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

        self.audit_service.log_action(
            db,
            action=f"Staff Ledger {data.entry_type}",
            target_table="staff_ledger_entries",
            target_id=str(entry.id),
            actor_id=actor_id,
            new_values={
                "employee": employee.full_name,
                "entry_type": data.entry_type,
                "amount": str(data.amount),
            },
        )
        return entry

    # -----------------------------------
    # Monthly Payroll Preview & Settlement
    # -----------------------------------

    def _month_bounds(self, billing_month: str) -> tuple[date, date]:
        year_str, month_str = billing_month.split("-")
        year, month = int(year_str), int(month_str)
        _, last_day = monthrange(year, month)
        return date(year, month, 1), date(year, month, last_day)

    def _monthly_commission(
        self,
        db: Session,
        employee: Employee,
        period_start: date,
        period_end: date,
    ) -> Decimal:
        rate = Decimal(str(employee.commission_rate_per_liter or 0))
        if rate <= Decimal("0"):
            return Decimal("0.00")

        liters = db.scalar(
            select(func.coalesce(func.sum(NozzleReading.sales), 0.0))
            .join(Shift, NozzleReading.shift_id == Shift.id)
            .where(
                Shift.employee_id == employee.id,
                NozzleReading.reading_date >= period_start,
                NozzleReading.reading_date <= period_end,
            )
        ) or 0.0
        return (Decimal(str(liters)) * rate).quantize(Decimal("0.01"))

    def payroll_preview(
        self,
        db: Session,
        billing_month: str,
    ) -> StaffPayrollPreviewResponse:
        period_start, period_end = self._month_bounds(billing_month)
        employees = self.get_all_active(db)

        rows: list[StaffPayrollRow] = []
        total_base = Decimal("0.00")
        total_comm = Decimal("0.00")
        total_ded = Decimal("0.00")
        total_net = Decimal("0.00")

        for emp in employees:
            base = Decimal(str(emp.base_salary or 0)).quantize(Decimal("0.01"))
            comm = self._monthly_commission(db, emp, period_start, period_end)

            entries = db.scalars(
                select(StaffLedgerEntry).where(StaffLedgerEntry.employee_id == emp.id)
            ).all()
            adv_loan = sum(
                (Decimal(str(e.amount)) for e in entries if e.entry_type in {"ADVANCE", "LOAN"}),
                Decimal("0.00"),
            )
            shortages = sum(
                (Decimal(str(e.amount)) for e in entries if e.entry_type == "SHORTAGE"),
                Decimal("0.00"),
            )
            outstanding = sum(
                (Decimal(str(e.signed_amount)) for e in entries),
                Decimal("0.00"),
            )

            gross = base + comm
            deductible = max(Decimal("0.00"), outstanding)
            deducted = min(gross, deductible)
            net_payable = max(Decimal("0.00"), gross - deducted)

            total_base += base
            total_comm += comm
            total_ded += deducted
            total_net += net_payable

            rows.append(
                StaffPayrollRow(
                    employee_uuid=str(emp.uuid),
                    full_name=emp.full_name,
                    role=emp.role,
                    base_salary=base,
                    commission_earned=comm,
                    advances_and_loans=adv_loan,
                    shift_shortages=shortages,
                    outstanding_balance=outstanding,
                    net_payable=net_payable,
                )
            )

        return StaffPayrollPreviewResponse(
            billing_month=billing_month,
            total_base_salary=total_base,
            total_commission=total_comm,
            total_deductions=total_ded,
            total_net_payable=total_net,
            rows=rows,
        )

    def pay_salary(
        self,
        db: Session,
        employee_uuid: str,
        data: StaffPayrollPayRequest,
        actor_id: int | None = None,
    ) -> StaffPayrollPayResponse:
        employee = self.get_by_uuid(db, employee_uuid)
        period_start, period_end = self._month_bounds(data.billing_month)

        base = Decimal(str(employee.base_salary or 0)).quantize(Decimal("0.01"))
        comm = (
            data.commission_override
            if data.commission_override is not None
            else self._monthly_commission(db, employee, period_start, period_end)
        )
        gross_pay = base + comm
        outstanding = self._outstanding_balance(db, employee.id)

        deducted_amount = Decimal("0.00")
        if data.deduct_outstanding and outstanding > Decimal("0.00"):
            deducted_amount = min(gross_pay, outstanding)

        net_paid = max(Decimal("0.00"), gross_pay - deducted_amount)

        if deducted_amount > Decimal("0.00"):
            settlement = StaffLedgerEntry(
                employee_id=employee.id,
                entry_date=date.today(),
                entry_type="SALARY_PAYMENT",
                amount=deducted_amount,
                signed_amount=-deducted_amount,
                remarks=data.remarks or f"Salary deduction for {data.billing_month}",
                reference_type="PAYROLL",
                pump_id=employee.pump_id,
            )
            db.add(settlement)
            db.commit()

        if net_paid > Decimal("0.00"):
            from app.schemas.income import IncomeCreate
            from app.services.income_service import IncomeService

            income_req = IncomeCreate(
                income_date=date.today(),
                kind=IncomeKind.EXPENSE,
                description=data.remarks or f"Salary payout ({data.billing_month}) — {employee.full_name}",
                amount=net_paid,
                category="Salary",
                payment_mode=PaymentMode(data.payment_mode),
                bank_account_uuid=data.bank_account_uuid,
            )
            IncomeService().create(db, income_req, actor_id=actor_id)

        remaining = self._outstanding_balance(db, employee.id)

        self.audit_service.log_action(
            db,
            action="Paid Staff Salary",
            target_table="employees",
            target_id=str(employee.id),
            actor_id=actor_id,
            new_values={
                "billing_month": data.billing_month,
                "gross_pay": str(gross_pay),
                "deducted": str(deducted_amount),
                "net_paid": str(net_paid),
            },
        )

        return StaffPayrollPayResponse(
            employee_uuid=str(employee.uuid),
            full_name=employee.full_name,
            billing_month=data.billing_month,
            gross_pay=gross_pay,
            deducted_amount=deducted_amount,
            net_paid=net_paid,
            remaining_balance=remaining,
        )