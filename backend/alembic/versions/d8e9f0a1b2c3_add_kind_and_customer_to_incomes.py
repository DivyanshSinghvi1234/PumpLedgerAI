"""add_kind_and_customer_to_incomes

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-07-20 01:00:00.000000

Adds:
- incomes.kind (INCOME/EXPENSE), new `incomekind` Postgres enum type
- incomes.customer_id (nullable FK to customers) — for loans posted to a
  customer's ledger

Idempotent per project convention: prod was built by create_all and stamped
past migrations by prestart.sh, so columns/types may already exist. Guarded by
has_column / an existing-type check.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import has_column, has_index


# revision identifiers, used by Alembic.
revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, Sequence[str], None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # The `incomekind` enum type is brand new (unlike `paymentmode`). On
    # Postgres create it if absent; on SQLite enums are plain VARCHAR so no
    # type object is needed.
    if bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

        kind_type = PG_ENUM("INCOME", "EXPENSE", name="incomekind", create_type=False)
        kind_type.create(bind, checkfirst=True)
    else:
        kind_type = sa.Enum("INCOME", "EXPENSE", name="incomekind")

    if not has_column("incomes", "kind"):
        # server_default backfills existing rows to INCOME; the model default
        # takes over for new inserts.
        op.add_column(
            "incomes",
            sa.Column(
                "kind",
                kind_type,
                nullable=False,
                server_default="INCOME",
            ),
        )
    if not has_index("incomes", "ix_incomes_kind"):
        op.create_index(op.f("ix_incomes_kind"), "incomes", ["kind"], unique=False)

    if not has_column("incomes", "customer_id"):
        op.add_column(
            "incomes",
            sa.Column("customer_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_incomes_customer_id",
            "incomes",
            "customers",
            ["customer_id"],
            ["id"],
        )
    if not has_index("incomes", "ix_incomes_customer_id"):
        op.create_index(
            op.f("ix_incomes_customer_id"), "incomes", ["customer_id"], unique=False
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_incomes_customer_id"), table_name="incomes")
    op.drop_constraint("fk_incomes_customer_id", "incomes", type_="foreignkey")
    op.drop_column("incomes", "customer_id")

    op.drop_index(op.f("ix_incomes_kind"), table_name="incomes")
    op.drop_column("incomes", "kind")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        sa.Enum(name="incomekind").drop(bind, checkfirst=True)
