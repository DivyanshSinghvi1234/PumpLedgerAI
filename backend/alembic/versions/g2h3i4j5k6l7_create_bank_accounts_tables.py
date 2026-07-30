"""create_bank_accounts_tables

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-07-30 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create bank_accounts table
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('pump_id', sa.Integer(), nullable=False),
        sa.Column('account_name', sa.String(length=100), nullable=False),
        sa.Column('bank_name', sa.String(length=100), nullable=False),
        sa.Column('account_number', sa.String(length=50), nullable=False),
        sa.Column('ifsc_code', sa.String(length=20), nullable=True),
        sa.Column('account_type', sa.String(length=30), nullable=False, server_default='CURRENT'),
        sa.Column('opening_balance', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('current_balance', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.ForeignKeyConstraint(['pump_id'], ['pumps.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bank_accounts_account_name'), 'bank_accounts', ['account_name'], unique=False)
    op.create_index(op.f('ix_bank_accounts_account_number'), 'bank_accounts', ['account_number'], unique=False)
    op.create_index(op.f('ix_bank_accounts_bank_name'), 'bank_accounts', ['bank_name'], unique=False)
    op.create_index(op.f('ix_bank_accounts_pump_id'), 'bank_accounts', ['pump_id'], unique=False)
    op.create_index(op.f('ix_bank_accounts_uuid'), 'bank_accounts', ['uuid'], unique=True)

    # 2. Create bank_transactions table
    op.create_table(
        'bank_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('pump_id', sa.Integer(), nullable=False),
        sa.Column('bank_account_id', sa.Integer(), nullable=True),
        sa.Column('transaction_type', sa.String(length=30), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('remarks', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['pump_id'], ['pumps.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bank_transactions_bank_account_id'), 'bank_transactions', ['bank_account_id'], unique=False)
    op.create_index(op.f('ix_bank_transactions_pump_id'), 'bank_transactions', ['pump_id'], unique=False)
    op.create_index(op.f('ix_bank_transactions_transaction_date'), 'bank_transactions', ['transaction_date'], unique=False)
    op.create_index(op.f('ix_bank_transactions_transaction_type'), 'bank_transactions', ['transaction_type'], unique=False)

    # 3. Add bank_account_id foreign key columns to payments, vouchers, incomes
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bank_account_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_payments_bank_account_id', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')

    with op.batch_alter_table('vouchers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bank_account_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_vouchers_bank_account_id', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')

    with op.batch_alter_table('incomes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bank_account_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_incomes_bank_account_id', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    with op.batch_alter_table('incomes', schema=None) as batch_op:
        batch_op.drop_constraint('fk_incomes_bank_account_id', type_='foreignkey')
        batch_op.drop_column('bank_account_id')

    with op.batch_alter_table('vouchers', schema=None) as batch_op:
        batch_op.drop_constraint('fk_vouchers_bank_account_id', type_='foreignkey')
        batch_op.drop_column('bank_account_id')

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_payments_bank_account_id', type_='foreignkey')
        batch_op.drop_column('bank_account_id')

    op.drop_table('bank_transactions')
    op.drop_table('bank_accounts')
