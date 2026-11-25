"""Tests for Step 1: Staff Salary, Loans, Advances, Shortages, and Payroll Settlement."""

from datetime import date
from decimal import Decimal

from app.core.enums import IncomeKind, PaymentMode
from app.models.employee import Employee
from app.models.income import Income
from app.models.pump import Pump
from app.schemas.employee import (
    StaffLedgerEntryCreate,
    StaffPayrollPayRequest,
)
from app.schemas.income import IncomeCreate
from app.services.employee_service import EmployeeService
from app.services.income_service import IncomeService


def _ensure_pump(db_session) -> Pump:
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Staff Test Pump", code="TST-STF", address="Highway")
        db_session.add(pump)
        db_session.flush()
    return pump


def test_income_expense_linked_to_employee_posts_staff_advance(db_session):
    from app.database.scoping import active_pump_id

    pump = _ensure_pump(db_session)
    token = active_pump_id.set(pump.id)
    try:
        emp_service = EmployeeService()
        inc_service = IncomeService()

        emp = Employee(
            full_name="Ramesh Attendant",
            role="OPERATOR",
            base_salary=Decimal("15000.00"),
            commission_rate_per_liter=Decimal("0.1000"),
            pump_id=pump.id,
        )
        db_session.add(emp)
        db_session.commit()
        db_session.refresh(emp)

        inc_service.create(
            db_session,
            IncomeCreate(
                income_date=date.today(),
                kind=IncomeKind.EXPENSE,
                description="Cash advance to Ramesh",
                amount=Decimal("3000.00"),
                category="Staff Advance",
                payment_mode=PaymentMode.CASH,
                employee_uuid=emp.uuid,
            ),
        )

        ledger = emp_service.get_ledger(db_session, str(emp.uuid))
        assert ledger.outstanding_balance == Decimal("3000.00")
        assert len(ledger.entries) == 1
        assert ledger.entries[0].entry_type == "ADVANCE"
    finally:
        active_pump_id.reset(token)


def test_staff_payroll_preview_and_pay_salary_deducts_advances_and_shortages(db_session):
    from app.database.scoping import active_pump_id

    pump = _ensure_pump(db_session)
    token = active_pump_id.set(pump.id)
    try:
        emp_service = EmployeeService()

        emp = Employee(
            full_name="Suresh Attendant",
            role="OPERATOR",
            base_salary=Decimal("18000.00"),
            pump_id=pump.id,
        )
        db_session.add(emp)
        db_session.commit()
        db_session.refresh(emp)

        emp_service.record_ledger_entry(
            db_session,
            str(emp.uuid),
            StaffLedgerEntryCreate(
                entry_date=date.today(),
                entry_type="LOAN",
                amount=Decimal("2000.00"),
                remarks="Personal loan",
            ),
        )
        emp_service.record_ledger_entry(
            db_session,
            str(emp.uuid),
            StaffLedgerEntryCreate(
                entry_date=date.today(),
                entry_type="SHORTAGE",
                amount=Decimal("500.00"),
                remarks="8 PM shift cash shortage",
            ),
        )

        month_str = date.today().strftime("%Y-%m")
        preview = emp_service.payroll_preview(db_session, month_str)
        row = next(r for r in preview.rows if r.employee_uuid == str(emp.uuid))

        assert row.base_salary == Decimal("18000.00")
        assert row.advances_and_loans == Decimal("2000.00")
        assert row.shift_shortages == Decimal("500.00")
        assert row.net_payable == Decimal("15500.00")

        paid = emp_service.pay_salary(
            db_session,
            str(emp.uuid),
            StaffPayrollPayRequest(
                billing_month=month_str,
                payment_mode="CASH",
                deduct_outstanding=True,
            ),
        )

        assert paid.gross_pay == Decimal("18000.00")
        assert paid.deducted_amount == Decimal("2500.00")
        assert paid.net_paid == Decimal("15500.00")
        assert paid.remaining_balance == Decimal("0.00")

        salary_expense = (
            db_session.query(Income)
            .filter(Income.category == "Salary", Income.amount == Decimal("15500.00"))
            .first()
        )
        assert salary_expense is not None
    finally:
        active_pump_id.reset(token)


def test_employee_http_create_and_payroll_preview(client, db_session):
    from app.core.dependencies import get_current_user
    from app.core.enums import UserRole
    from app.main import app
    from app.models.user import User

    pump = _ensure_pump(db_session)
    fake_admin = User(
        id=1,
        username="staff_admin",
        full_name="Staff Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: fake_admin
    try:
        headers = {"X-Pump-UUID": str(pump.uuid)}
        create_res = client.post(
            "/api/v1/employees",
            headers=headers,
            json={
                "full_name": "HTTP Test Operator",
                "role": "OPERATOR",
                "base_salary": 14000,
                "commission_rate_per_liter": 0.05,
            },
        )
        assert create_res.status_code == 201, create_res.text

        month_str = date.today().strftime("%Y-%m")
        prev_res = client.get(
            f"/api/v1/employees/payroll/preview?month={month_str}",
            headers=headers,
        )
        assert prev_res.status_code == 200, prev_res.text
        names = [r["full_name"] for r in prev_res.json()["rows"]]
        assert "HTTP Test Operator" in names
    finally:
        app.dependency_overrides.pop(get_current_user, None)
