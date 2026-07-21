"""create_voucher_items_table

Revision ID: 0c4096ed4c2c
Revises: 44e5dce5cfe0
Create Date: 2026-07-16 20:07:26.262145

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c4096ed4c2c'
down_revision: Union[str, Sequence[str], None] = '44e5dce5cfe0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Delete all existing transactions to start with a clean slate
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM voucher_settlements"))
    bind.execute(sa.text("DELETE FROM payments"))
    bind.execute(sa.text("DELETE FROM ledger_entries"))
    bind.execute(sa.text("DELETE FROM vouchers"))

    # Ensure last_active_at exists on users table
    has_column = False
    try:
        bind.execute(sa.text("SELECT last_active_at FROM users LIMIT 1"))
        has_column = True
    except Exception:
        try:
            bind.execute(sa.text("ROLLBACK"))
        except Exception:
            pass

    # Determine dialect-specific Enum type
    if bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
        fuel_type_type = PG_ENUM('PETROL', 'SPEED', 'DIESEL', 'LUBRICANT', name='fueltype', create_type=False)
        try:
            res = bind.execute(sa.text("SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'"))
            print("DIAGNOSTIC - Types in database right before create_table:")
            for row in res:
                print("  Type:", row[0])
            res = bind.execute(sa.text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
            print("DIAGNOSTIC - Tables in database right before create_table:")
            for row in res:
                print("  Table:", row[0])
        except Exception as err:
            print("DIAGNOSTIC - Failed to query schema:", err)
    else:
        fuel_type_type = sa.Enum('PETROL', 'SPEED', 'DIESEL', 'LUBRICANT', name='fueltype')

    # Create the table
    op.create_table('voucher_items',
    sa.Column('voucher_id', sa.Integer(), nullable=False),
    sa.Column('fuel_type', fuel_type_type, nullable=False),
    sa.Column('quantity_liters', sa.Numeric(precision=10, scale=3), nullable=False),
    sa.Column('rate_per_liter', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('uuid', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['voucher_id'], ['vouchers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_voucher_items_id'), 'voucher_items', ['id'], unique=False)
    op.create_index(op.f('ix_voucher_items_uuid'), 'voucher_items', ['uuid'], unique=True)
    op.create_index(op.f('ix_voucher_items_voucher_id'), 'voucher_items', ['voucher_id'], unique=False)

    if has_column:
        bind.execute(sa.text("UPDATE users SET last_active_at = NULL"))
        with op.batch_alter_table('users') as batch_op:
            batch_op.alter_column('last_active_at',
                       existing_type=sa.NUMERIC(),
                       type_=sa.DateTime(timezone=True),
                       existing_nullable=True)
    else:
        op.add_column('users', sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('vouchers') as batch_op:
        batch_op.alter_column('fuel_type',
                   existing_type=sa.VARCHAR(length=9),
                   nullable=True)
        batch_op.alter_column('quantity_liters',
                   existing_type=sa.Numeric(precision=10, scale=3),
                   nullable=True)
        batch_op.alter_column('rate_per_liter',
                   existing_type=sa.Numeric(precision=10, scale=2),
                   nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('vouchers') as batch_op:
        batch_op.alter_column('rate_per_liter',
                   existing_type=sa.Numeric(precision=10, scale=2),
                   nullable=False)
        batch_op.alter_column('quantity_liters',
                   existing_type=sa.Numeric(precision=10, scale=3),
                   nullable=False)
        batch_op.alter_column('fuel_type',
                   existing_type=sa.VARCHAR(length=9),
                   nullable=False)

    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('last_active_at',
                   existing_type=sa.DateTime(timezone=True),
                   type_=sa.NUMERIC(),
                   existing_nullable=True)

    op.drop_index(op.f('ix_voucher_items_voucher_id'), table_name='voucher_items')
    op.drop_index(op.f('ix_voucher_items_uuid'), table_name='voucher_items')
    op.drop_index(op.f('ix_voucher_items_id'), table_name='voucher_items')
    op.drop_table('voucher_items')
