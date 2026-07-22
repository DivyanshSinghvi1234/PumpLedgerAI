"""scope_audit_logs_by_pump

Revision ID: e1f2a3b4c5d6
Revises: bc2ec109d26f
Create Date: 2026-07-22 00:00:00.000000

Adds audit_logs.pump_id (FK to pumps) so the audit trail is isolated per
filling station, matching the other 14 pump-scoped models. Legacy rows predate
multi-tenant scoping, so their true pump is unrecoverable — they're backfilled
to the first pump.

Idempotent per project convention: prod was built by create_all and the
init_db backfill may already have added the column. Guarded by has_column.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import has_column, has_index


# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "bc2ec109d26f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not has_column("audit_logs", "pump_id"):
        op.add_column(
            "audit_logs",
            sa.Column("pump_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_audit_logs_pump_id",
            "audit_logs",
            "pumps",
            ["pump_id"],
            ["id"],
            ondelete="CASCADE",
        )
        # Backfill existing rows to the first pump.
        bind = op.get_bind()
        first_pump_id = bind.execute(
            sa.text("SELECT id FROM pumps ORDER BY id LIMIT 1")
        ).scalar()
        if first_pump_id is not None:
            bind.execute(
                sa.text("UPDATE audit_logs SET pump_id = :pid WHERE pump_id IS NULL"),
                {"pid": first_pump_id},
            )

    if not has_index("audit_logs", "ix_audit_logs_pump_id"):
        op.create_index(
            op.f("ix_audit_logs_pump_id"), "audit_logs", ["pump_id"], unique=False
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_pump_id"), table_name="audit_logs")
    op.drop_constraint("fk_audit_logs_pump_id", "audit_logs", type_="foreignkey")
    op.drop_column("audit_logs", "pump_id")
