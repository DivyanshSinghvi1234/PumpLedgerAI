"""add attendance, tank avg cost, and indent bank fields

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-11-26 00:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j5k6l7m8n9o0"
down_revision: Union[str, Sequence[str], None] = "i4j5k6l7m8n9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fuel_tanks", sa.Column("avg_cost_per_liter", sa.Float(), nullable=True))
    op.add_column(
        "purchase_indents",
        sa.Column("payment_mode", sa.String(length=20), nullable=False, server_default="CREDIT"),
    )
    op.add_column(
        "purchase_indents",
        sa.Column("bank_account_uuid", sa.String(length=36), nullable=True),
    )

    op.create_table(
        "employee_attendance",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pump_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PRESENT"),
        sa.Column("overtime_hours", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0.00"),
        sa.Column("shift_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shift_id"], ["shifts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint("pump_id", "employee_id", "attendance_date", name="uq_employee_attendance_pump_emp_date"),
    )
    op.create_index("ix_employee_attendance_pump_id", "employee_attendance", ["pump_id"])
    op.create_index("ix_employee_attendance_employee_id", "employee_attendance", ["employee_id"])
    op.create_index("ix_employee_attendance_attendance_date", "employee_attendance", ["attendance_date"])


def downgrade() -> None:
    op.drop_index("ix_employee_attendance_attendance_date", table_name="employee_attendance")
    op.drop_index("ix_employee_attendance_employee_id", table_name="employee_attendance")
    op.drop_index("ix_employee_attendance_pump_id", table_name="employee_attendance")
    op.drop_table("employee_attendance")

    op.drop_column("purchase_indents", "bank_account_uuid")
    op.drop_column("purchase_indents", "payment_mode")
    op.drop_column("fuel_tanks", "avg_cost_per_liter")
