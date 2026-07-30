"""add split payment mode amounts to vouchers

Revision ID: c8f9a0b1c2d3
Revises: 4bc2474a5d81
"""

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import add_column_if_missing, drop_column_if_exists

revision = "c8f9a0b1c2d3"
down_revision = "4bc2474a5d81"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing(
        "vouchers",
        sa.Column("cash_amount", sa.Numeric(12, 2), nullable=True),
    )
    add_column_if_missing(
        "vouchers",
        sa.Column("upi_amount", sa.Numeric(12, 2), nullable=True),
    )
    add_column_if_missing(
        "vouchers",
        sa.Column("card_amount", sa.Numeric(12, 2), nullable=True),
    )
    add_column_if_missing(
        "vouchers",
        sa.Column("credit_amount", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    drop_column_if_exists("vouchers", "cash_amount")
    drop_column_if_exists("vouchers", "upi_amount")
    drop_column_if_exists("vouchers", "card_amount")
    drop_column_if_exists("vouchers", "credit_amount")
