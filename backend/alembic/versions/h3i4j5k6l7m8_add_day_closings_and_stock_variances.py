"""add_day_closings_and_stock_variances

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-11-26 00:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "h3i4j5k6l7m8"
down_revision: Union[str, None] = "g2h3i4j5k6l7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "day_closings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("pump_id", sa.Integer(), nullable=False),
        sa.Column("closing_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="CLOSED"),
        sa.Column("gross_meter_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("cash_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("upi_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("card_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("bank_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("credit_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("total_voucher_sales", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("cash_expenses", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("opening_float", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("physical_cash_counted", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("cash_to_next_day", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("expected_cash", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("variance", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("notes_500", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes_200", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes_100", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes_50", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes_20", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes_10", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coins", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("closed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("nozzle_snapshot", sa.JSON(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["closed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["pump_id"], ["pumps.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pump_id", "closing_date", name="uq_day_closing_pump_date"),
    )
    op.create_index(op.f("ix_day_closings_closing_date"), "day_closings", ["closing_date"], unique=False)
    op.create_index(op.f("ix_day_closings_pump_id"), "day_closings", ["pump_id"], unique=False)
    op.create_index(op.f("ix_day_closings_uuid"), "day_closings", ["uuid"], unique=True)

    op.create_table(
        "stock_variances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("pump_id", sa.Integer(), nullable=False),
        sa.Column("tank_id", sa.Integer(), nullable=False),
        sa.Column("variance_date", sa.Date(), nullable=False),
        sa.Column("opening_stock", sa.Float(), nullable=False),
        sa.Column("deliveries_received", sa.Float(), nullable=False, server_default="0"),
        sa.Column("meter_sales", sa.Float(), nullable=False, server_default="0"),
        sa.Column("testing_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("book_stock", sa.Float(), nullable=False),
        sa.Column("physical_dip", sa.Float(), nullable=True),
        sa.Column("variance_liters", sa.Float(), nullable=True),
        sa.Column("variance_percent", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING_DIP"),
        sa.Column("threshold_percent", sa.Float(), nullable=False, server_default="0.5"),
        sa.ForeignKeyConstraint(["pump_id"], ["pumps.id"]),
        sa.ForeignKeyConstraint(["tank_id"], ["fuel_tanks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pump_id", "tank_id", "variance_date", name="uq_stock_variance_tank_date"),
    )
    op.create_index(op.f("ix_stock_variances_pump_id"), "stock_variances", ["pump_id"], unique=False)
    op.create_index(op.f("ix_stock_variances_tank_id"), "stock_variances", ["tank_id"], unique=False)
    op.create_index(op.f("ix_stock_variances_uuid"), "stock_variances", ["uuid"], unique=True)
    op.create_index(op.f("ix_stock_variances_variance_date"), "stock_variances", ["variance_date"], unique=False)


def downgrade() -> None:
    op.drop_table("stock_variances")
    op.drop_table("day_closings")
