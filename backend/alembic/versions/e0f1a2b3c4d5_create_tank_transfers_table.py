"""create tank transfers table

Revision ID: e0f1a2b3c4d5
Revises: d9a0b1c2d3e4
"""

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime

revision = "e0f1a2b3c4d5"
down_revision = "d9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "tank_transfers" not in inspector.get_table_names():
        op.create_table(
            "tank_transfers",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())),
            sa.Column("transfer_date", sa.Date(), nullable=False, index=True),
            sa.Column("source_tank_id", sa.Integer(), sa.ForeignKey("fuel_tanks.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("destination_tank_id", sa.Integer(), sa.ForeignKey("fuel_tanks.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("quantity_liters", sa.Float(), nullable=False),
            sa.Column("reason", sa.String(150), nullable=False),
            sa.Column("remarks", sa.String(500), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("pump_id", sa.Integer(), nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "tank_transfers" in inspector.get_table_names():
        op.drop_table("tank_transfers")
