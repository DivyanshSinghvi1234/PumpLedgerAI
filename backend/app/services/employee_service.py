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
    AttendanceRecordResponse,
    AttendanceRecordUpsert,
    AttendanceSyncResponse,
    StaffLedgerEntryResponse,
    StaffLedgerSummaryResponse,
    StaffBatchPayrollRequest,
    StaffBatchPayrollResponse,
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

    def _prorated_base_salary(
        self,
        db: Session,
        employee: Employee,
        billing_month: str,
    ) -> tuple[Decimal, float | None, int]:
        """Return (effective_base_salary, days_worked_or_None, days_in_month).
        If attendance records exist for the employee in billing_month, pro-rate base salary;
        otherwise fall back to full base_salary."""
        from app.models.employee_attendance import EmployeeAttendance

        period_start, period_end = self._month_bounds(billing_month)
        days_in_month = (period_end - period_start).days + 1
        base = Decimal(str(employee.base_salary or 0)).quantize(Decimal("0.01"))

        records = list(
            db.scalars(
                select(EmployeeAttendance).where(
                    EmployeeAttendance.employee_id == employee.id,
                    EmployeeAttendance.attendance_date >= period_start,
                    EmployeeAttendance.attendance_date <= period_end,
                )
            ).all()
        )
        if not records:
            return base, None, days_in_month

        days_worked = 0.0
        for rec in records:
            if rec.status in ("PRESENT", "LEAVE"):
                days_worked += 1.0
            elif rec.status == "HALF_DAY":
                days_worked += 0.5

        effective = (base * Decimal(str(days_worked)) / Decimal(days_in_month)).quantize(
            Decimal("0.01")
        )
        return effective, days_worked, days_in_month

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
            prorated_base, days_worked, days_in_month = self._prorated_base_salary(
                db, emp, billing_month
            )
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

            gross = prorated_base + comm
            deductible = max(Decimal("0.00"), outstanding)
            deducted = min(gross, deductible)
            net_payable = max(Decimal("0.00"), gross - deducted)

            total_base += prorated_base
            total_comm += comm
            total_ded += deducted
            total_net += net_payable

            rows.append(
                StaffPayrollRow(
                    employee_uuid=str(emp.uuid),
                    full_name=emp.full_name,
                    role=emp.role,
                    base_salary=base,
                    days_worked=days_worked,
                    days_in_month=days_in_month,
                    prorated_base_salary=prorated_base,
                    commission_earned=comm,
                    advances_and_loans=adv_loan,
                    shift_shortages=shortages,
                    outstanding_balance=outstanding,
                    net_payable=net_payable,
                    already_paid_this_month=self._is_paid_for_month(db, emp, billing_month),
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

        base, _, _ = self._prorated_base_salary(db, employee, data.billing_month)
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

    def _is_paid_for_month(self, db: Session, employee: Employee, billing_month: str) -> bool:
        from app.models.income import Income

        paid_income = db.scalar(
            select(Income.id)
            .where(
                Income.is_active.is_(True),
                Income.category == "Salary",
                Income.description.contains(f"({billing_month})"),
                Income.description.contains(employee.full_name),
            )
            .limit(1)
        )
        if paid_income is not None:
            return True

        paid_ledger = db.scalar(
            select(StaffLedgerEntry.id)
            .where(
                StaffLedgerEntry.employee_id == employee.id,
                StaffLedgerEntry.reference_type == "PAYROLL",
                StaffLedgerEntry.remarks.contains(billing_month),
            )
            .limit(1)
        )
        return paid_ledger is not None

    def pay_all_salaries(
        self,
        db: Session,
        data: StaffBatchPayrollRequest,
        actor_id: int | None = None,
    ) -> StaffBatchPayrollResponse:
        """Pay monthly salaries for all unpaid active staff (or selected UUIDs) in one batch."""
        preview = self.payroll_preview(db, data.billing_month)
        target_uuids = set(data.employee_uuids) if data.employee_uuids else None

        results: list[StaffPayrollPayResponse] = []
        skipped_count = 0
        total_net_paid = Decimal("0.00")

        for row in preview.rows:
            if target_uuids is not None and row.employee_uuid not in target_uuids:
                continue
            if row.already_paid_this_month:
                skipped_count += 1
                continue
            if row.net_payable <= Decimal("0.00") and row.outstanding_balance <= Decimal("0.00"):
                skipped_count += 1
                continue

            res = self.pay_salary(
                db,
                row.employee_uuid,
                StaffPayrollPayRequest(
                    billing_month=data.billing_month,
                    payment_mode=data.payment_mode,
                    bank_account_uuid=data.bank_account_uuid,
                    deduct_outstanding=data.deduct_outstanding,
                    remarks=data.remarks,
                ),
                actor_id=actor_id,
            )
            results.append(res)
            total_net_paid += res.net_paid

        return StaffBatchPayrollResponse(
            billing_month=data.billing_month,
            paid_count=len(results),
            skipped_count=skipped_count,
            total_net_paid=total_net_paid.quantize(Decimal("0.01")),
            results=results,
        )

    def list_attendance(
        self,
        db: Session,
        billing_month: str,
    ) -> list[AttendanceRecordResponse]:
        from app.models.employee_attendance import EmployeeAttendance

        period_start, period_end = self._month_bounds(billing_month)
        rows = db.scalars(
            select(EmployeeAttendance)
            .where(
                EmployeeAttendance.attendance_date >= period_start,
                EmployeeAttendance.attendance_date <= period_end,
            )
            .order_by(EmployeeAttendance.attendance_date.desc(), EmployeeAttendance.id.asc())
        ).all()
        return [
            AttendanceRecordResponse(
                uuid=str(r.uuid),
                employee_uuid=str(r.employee.uuid),
                employee_name=r.employee.full_name,
                attendance_date=r.attendance_date,
                status=r.status,
                overtime_hours=r.overtime_hours,
                notes=r.notes,
            )
            for r in rows
            if r.employee is not None
        ]

    def upsert_attendance(
        self,
        db: Session,
        data: AttendanceRecordUpsert,
    ) -> AttendanceRecordResponse:
        from app.models.employee_attendance import EmployeeAttendance

        emp = self.get_by_uuid(db, data.employee_uuid)
        existing = db.scalar(
            select(EmployeeAttendance).where(
                EmployeeAttendance.employee_id == emp.id,
                EmployeeAttendance.attendance_date == data.attendance_date,
            )
        )
        if existing is not None:
            existing.status = data.status
            existing.overtime_hours = data.overtime_hours
            existing.notes = data.notes
            rec = existing
        else:
            rec = EmployeeAttendance(
                employee_id=emp.id,
                attendance_date=data.attendance_date,
                status=data.status,
                overtime_hours=data.overtime_hours,
                notes=data.notes,
                pump_id=emp.pump_id,
            )
            db.add(rec)
        db.commit()
        db.refresh(rec)
        return AttendanceRecordResponse(
            uuid=str(rec.uuid),
            employee_uuid=str(emp.uuid),
            employee_name=emp.full_name,
            attendance_date=rec.attendance_date,
            status=rec.status,
            overtime_hours=rec.overtime_hours,
            notes=rec.notes,
        )

    def sync_attendance_from_shifts(
        self,
        db: Session,
        attendance_date: date,
    ) -> AttendanceSyncResponse:
        """Auto-mark employees who worked a shift on attendance_date as PRESENT."""
        from app.models.employee_attendance import EmployeeAttendance

        shifts = db.scalars(
            select(Shift).where(
                Shift.employee_id.is_not(None),
                func.date(Shift.start_time) == attendance_date,
            )
        ).all()
        marked = 0
        seen_emp_ids: set[int] = set()
        for sh in shifts:
            if sh.employee_id is None or sh.employee_id in seen_emp_ids:
                continue
            seen_emp_ids.add(sh.employee_id)
            exists = db.scalar(
                select(EmployeeAttendance.id).where(
                    EmployeeAttendance.employee_id == sh.employee_id,
                    EmployeeAttendance.attendance_date == attendance_date,
                )
            )
            if exists is None:
                db.add(
                    EmployeeAttendance(
                        employee_id=sh.employee_id,
                        attendance_date=attendance_date,
                        status="PRESENT",
                        overtime_hours=Decimal("0.00"),
                        shift_id=sh.id,
                        notes="Auto-marked from shift",
                        pump_id=sh.pump_id,
                    )
                )
                marked += 1
        if marked > 0:
            db.commit()
        return AttendanceSyncResponse(
            attendance_date=attendance_date,
            marked_present_count=marked,
        )

    def sync_from_users(self, db: Session) -> list[Employee]:
        """Create Employee profiles for any active OPERATOR/MANAGER users who don't have one yet."""
        from app.core.enums import UserRole
        from app.database.scoping import active_pump_id
        from app.models.user import User

        pump_id = active_pump_id.get()
        users = db.scalars(
            select(User).where(
                User.is_active.is_(True),
                User.role.in_([UserRole.OPERATOR, UserRole.MANAGER]),
            )
        ).all()

        existing_names = {
            e.full_name.strip().lower()
            for e in self.get_all_active(db)
        }
        created: list[Employee] = []
        for u in users:
            name = (u.full_name or u.username).strip()
            if name.lower() in existing_names:
                continue
            emp = Employee(
                full_name=name,
                role=u.role.value if hasattr(u.role, "value") else str(u.role),
                base_salary=Decimal("0.00"),
                commission_rate_per_liter=Decimal("0.0000"),
                pump_id=pump_id,
            )
            db.add(emp)
            created.append(emp)
            existing_names.add(name.lower())

        if created:
            db.commit()
            for emp in created:
                db.refresh(emp)
        return created