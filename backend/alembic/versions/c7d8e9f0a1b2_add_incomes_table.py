"""add_incomes_table

Revision ID: c7d8e9f0a1b2
Revises: 48eed73943a5
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import has_table, has_index


# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = '48eed73943a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Idempotent: prod DBs were originally built by ``create_all`` and stamped
    past this revision by prestart.sh, so the table may already exist. Guard
    on has_table/has_index (see alembic_helpers/idempotent.py).
    """
    bind = op.get_bind()

    # The `paymentmode` enum type already exists (created by the initial
    # schema migration / create_all). On Postgres, re-declaring it with a bare
    # sa.Enum would emit CREATE TYPE and fail with "type already exists", so
    # reference the existing type with create_type=False. On SQLite enums are
    # plain VARCHAR, so a normal sa.Enum is fine. (Mirrors 0c4096ed4c2c.)
    if bind.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
        payment_mode_type = PG_ENUM(
            'CASH', 'UPI', 'CARD', 'CREDIT',
            name='paymentmode',
            create_type=False,
        )
    else:
        payment_mode_type = sa.Enum('CASH', 'UPI', 'CARD', 'CREDIT', name='paymentmode')

    if not has_table('incomes'):
        op.create_table(
            'incomes',
            sa.Column('income_date', sa.Date(), nullable=False),
            sa.Column('description', sa.String(length=300), nullable=False),
            sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('category', sa.String(length=100), nullable=True),
            sa.Column(
                'payment_mode',
                payment_mode_type,
                nullable=False,
            ),
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('uuid', sa.String(length=36), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column('pump_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['pump_id'], ['pumps.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    for index_name, column in (
        ('ix_incomes_income_date', 'income_date'),
        ('ix_incomes_category', 'category'),
        ('ix_incomes_id', 'id'),
        ('ix_incomes_pump_id', 'pump_id'),
    ):
        if not has_index('incomes', index_name):
            op.create_index(op.f(index_name), 'incomes', [column], unique=False)

    if not has_index('incomes', 'ix_incomes_uuid'):
        op.create_index(op.f('ix_incomes_uuid'), 'incomes', ['uuid'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('incomes')
