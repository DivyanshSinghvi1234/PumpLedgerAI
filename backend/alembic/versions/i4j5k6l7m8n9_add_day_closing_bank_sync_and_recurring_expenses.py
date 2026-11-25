"""add day closing bank sync and recurring expenses

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-11-26 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "i4j5k6l7m8n9"
down_revision: Union[str, Sequence[str], None] = "h3i4j5k6l7m8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "day_closings",
        sa.Column("settlement_bank_account_uuid", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "day_closings",
        sa.Column(
            "cash_deposited_to_bank",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default="0.00",
        ),
    )
    op.add_column(
        "day_closings",
        sa.Column("synced_bank_txn_ids", sa.JSON(), nullable=True),
    )

    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("pump_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("frequency", sa.String(length=20), nullable=False),
        sa.Column("due_day", sa.Integer(), nullable=True),
        sa.Column(
            "payment_mode",
            sa.Enum("CASH", "UPI", "CARD", "BANK", "CREDIT", "SPLIT", name="payment_mode_enum", native_enum=False),
            nullable=False,
        ),
        sa.Column("bank_account_uuid", sa.String(length=36), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("last_posted_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index("ix_recurring_expenses_pump_id", "recurring_expenses", ["pump_id"])
    op.create_index("ix_recurring_expenses_next_due_date", "recurring_expenses", ["next_due_date"])


def downgrade() -> None:
    op.drop_index("ix_recurring_expenses_next_due_date", table_name="recurring_expenses")
    op.drop_index("ix_recurring_expenses_pump_id", table_name="recurring_expenses")
    op.drop_table("recurring_expenses")

    op.drop_column("day_closings", "synced_bank_txn_ids")
    op.drop_column("day_closings", "cash_deposited_to_bank")
    op.drop_column("day_closings", "settlement_bank_account_uuid")
