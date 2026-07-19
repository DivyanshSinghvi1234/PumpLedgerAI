"""add delivery tracking and three-way reconciliation fields"""

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import (
    add_column_if_missing,
    drop_column_if_exists,
    has_fk,
    has_index,
    has_table,
)

revision = "a1b2c3d4e5f6"
down_revision = "44e5dce5cfe0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing("nozzles", sa.Column("tank_id", sa.Integer(), nullable=True))
    add_column_if_missing("nozzles", sa.Column("meter_capacity", sa.Float(), nullable=False, server_default="1000000"))
    # SQLite can't ALTER-ADD a named FK after the fact; only create it where the
    # backend supports it and it isn't already present.
    if op.get_bind().dialect.name != "sqlite" and not has_fk("nozzles", "fk_nozzles_tank_id"):
        op.create_foreign_key("fk_nozzles_tank_id", "nozzles", "fuel_tanks", ["tank_id"], ["id"], ondelete="SET NULL")
    for name in ("deliveries_liters", "nozzle_sales_liters", "unbilled_cash_variance", "physical_leak_variance", "variance_tolerance_liters"):
        add_column_if_missing("dip_readings", sa.Column(name, sa.Float(), nullable=False, server_default="0"))
    if has_table("tanker_deliveries"):
        return
    op.create_table(
        "tanker_deliveries",
        sa.Column("tank_id", sa.Integer(), nullable=False),
        sa.Column("delivery_date", sa.Date(), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=False),
        sa.Column("quantity_liters", sa.Float(), nullable=False),
        sa.Column("density", sa.Float(), nullable=True),
        sa.Column("supplier_name", sa.String(length=150), nullable=True),
        sa.Column("remarks", sa.String(length=500), nullable=True),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", sa.String(length=36), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("pump_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["tank_id"], ["fuel_tanks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pump_id"], ["pumps.id"]),
    )
    if not has_index("tanker_deliveries", "ix_tanker_deliveries_delivery_date"):
        op.create_index("ix_tanker_deliveries_delivery_date", "tanker_deliveries", ["delivery_date"])


def downgrade() -> None:
    op.drop_table("tanker_deliveries")
    for name in ("variance_tolerance_liters", "physical_leak_variance", "unbilled_cash_variance", "nozzle_sales_liters", "deliveries_liters"):
        drop_column_if_exists("dip_readings", name)
    if op.get_bind().dialect.name != "sqlite" and has_fk("nozzles", "fk_nozzles_tank_id"):
        op.drop_constraint("fk_nozzles_tank_id", "nozzles", type_="foreignkey")
    drop_column_if_exists("nozzles", "meter_capacity")
    drop_column_if_exists("nozzles", "tank_id")
