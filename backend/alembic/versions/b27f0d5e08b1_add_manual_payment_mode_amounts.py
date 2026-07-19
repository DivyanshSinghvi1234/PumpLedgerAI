"""add manual daily payment-mode amounts

Revision ID: b27f0d5e08b1
Revises: a1b2c3d4e5f6
"""

from alembic import op
import sqlalchemy as sa

revision = "b27f0d5e08b1"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_sheets",
        sa.Column("manual_payment_mode_amounts_data", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("daily_sheets", "manual_payment_mode_amounts_data")
