"""add meter rollover and replacement flags to nozzle_readings

Revision ID: d9a0b1c2d3e4
Revises: c8f9a0b1c2d3
"""

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import add_column_if_missing, drop_column_if_exists

revision = "d9a0b1c2d3e4"
down_revision = "c8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing(
        "nozzle_readings",
        sa.Column("is_rollover", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    add_column_if_missing(
        "nozzle_readings",
        sa.Column("is_meter_replaced", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    drop_column_if_exists("nozzle_readings", "is_rollover")
    drop_column_if_exists("nozzle_readings", "is_meter_replaced")
