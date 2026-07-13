"""add customer improvements and voucher relations

Revision ID: 23e0d849ccb1
Revises: 6144dfb2ea9c
Create Date: 2026-07-11 12:08:50.929844

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "23e0d849ccb1"
down_revision: Union[str, Sequence[str], None] = "6144dfb2ea9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ===========================
    # Customers
    # ===========================

    op.add_column(
        "customers",
        sa.Column(
            "mobile",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "city",
            sa.String(length=100),
            nullable=True,
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "state",
            sa.String(length=100),
            nullable=True,
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "pincode",
            sa.String(length=10),
            nullable=True,
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "opening_balance",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "remarks",
            sa.String(length=500),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_customers_mobile",
        "customers",
        ["mobile"],
        unique=True,
    )

    # Remove old phone column
    op.drop_index(
        "ix_customers_phone",
        table_name="customers",
    )

    op.drop_column(
        "customers",
        "phone",
    )

    # Remove temporary default
    op.alter_column(
        "customers",
        "opening_balance",
        server_default=None,
    )

    # ===========================
    # Voucher Relations
    # ===========================

    op.add_column(
        "vouchers",
        sa.Column(
            "customer_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "vouchers",
        sa.Column(
            "vehicle_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_vouchers_customer_id",
        "vouchers",
        ["customer_id"],
    )

    op.create_index(
        "ix_vouchers_vehicle_id",
        "vouchers",
        ["vehicle_id"],
    )

    op.create_foreign_key(
        "fk_vouchers_customer",
        "vouchers",
        "customers",
        ["customer_id"],
        ["id"],
    )

    op.create_foreign_key(
        "fk_vouchers_vehicle",
        "vouchers",
        "vehicles",
        ["vehicle_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_constraint(
        "fk_vouchers_vehicle",
        "vouchers",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_vouchers_customer",
        "vouchers",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_vouchers_vehicle_id",
        table_name="vouchers",
    )

    op.drop_index(
        "ix_vouchers_customer_id",
        table_name="vouchers",
    )

    op.drop_column(
        "vouchers",
        "vehicle_id",
    )

    op.drop_column(
        "vouchers",
        "customer_id",
    )

    op.add_column(
        "customers",
        sa.Column(
            "phone",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_customers_phone",
        "customers",
        ["phone"],
        unique=True,
    )

    op.drop_index(
        "ix_customers_mobile",
        table_name="customers",
    )

    op.drop_column(
        "customers",
        "remarks",
    )

    op.drop_column(
        "customers",
        "opening_balance",
    )

    op.drop_column(
        "customers",
        "pincode",
    )

    op.drop_column(
        "customers",
        "state",
    )

    op.drop_column(
        "customers",
        "city",
    )

    op.drop_column(
        "customers",
        "mobile",
    )