"""create purchase indents table

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
"""

from alembic import op
import sqlalchemy as sa
import uuid

revision = "f1a2b3c4d5e6"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "purchase_indents" not in inspector.get_table_names():
        op.create_table(
            "purchase_indents",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())),
            sa.Column("indent_number", sa.String(50), nullable=False, unique=True, index=True),
            sa.Column("omc_company", sa.String(50), nullable=False, server_default="IOCL"),
            sa.Column("terminal_name", sa.String(100), nullable=False),
            sa.Column("fuel_type", sa.String(50), nullable=False),
            sa.Column("ordered_liters", sa.Float(), nullable=False),
            sa.Column("tank_truck_number", sa.String(50), nullable=True),
            sa.Column("expected_delivery_date", sa.Date(), nullable=False, index=True),
            sa.Column("actual_delivery_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(50), nullable=False, server_default="INDENTED", index=True),
            sa.Column("decanted_tank_id", sa.Integer(), sa.ForeignKey("fuel_tanks.id", ondelete="SET NULL"), nullable=True),
            sa.Column("density_at_15c", sa.Float(), nullable=True),
            sa.Column("procurement_cost_per_liter", sa.Float(), nullable=True),
            sa.Column("total_invoice_amount", sa.Float(), nullable=True),
            sa.Column("invoice_number", sa.String(100), nullable=True),
            sa.Column("remarks", sa.String(500), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("pump_id", sa.Integer(), nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "purchase_indents" in inspector.get_table_names():
        op.drop_table("purchase_indents")
