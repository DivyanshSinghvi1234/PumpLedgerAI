"""add shift_handovers table

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-11-26 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k6l7m8n9o0p1"
down_revision: Union[str, Sequence[str], None] = "j5k6l7m8n9o0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shift_handovers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pump_id", sa.Integer(), nullable=False),
        sa.Column("handover_date", sa.Date(), nullable=False),
        sa.Column("outgoing_employee_id", sa.Integer(), nullable=False),
        sa.Column("incoming_employee_id", sa.Integer(), nullable=True),
        sa.Column("cash_expected", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("cash_handed_over", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("variance", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("meter_snapshot", sa.JSON(), nullable=True),
        sa.Column("outgoing_confirmed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("incoming_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("incoming_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shortage_posted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(["outgoing_employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incoming_employee_id"], ["employees.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index("ix_shift_handovers_pump_id", "shift_handovers", ["pump_id"])
    op.create_index("ix_shift_handovers_handover_date", "shift_handovers", ["handover_date"])


def downgrade() -> None:
    op.drop_index("ix_shift_handovers_handover_date", table_name="shift_handovers")
    op.drop_index("ix_shift_handovers_pump_id", table_name="shift_handovers")
    op.drop_table("shift_handovers")
