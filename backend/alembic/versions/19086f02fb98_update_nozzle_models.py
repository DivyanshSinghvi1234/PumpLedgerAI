"""update_nozzle_models

Revision ID: 19086f02fb98
Revises: 5d42468ae07a
Create Date: 2026-07-14 11:57:32.720369

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '19086f02fb98'
down_revision: Union[str, Sequence[str], None] = '5d42468ae07a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create nozzles table
    if 'nozzles' not in tables:
        op.create_table('nozzles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('uuid', sa.String(length=36), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('pipe_1_fuel_type', sa.Enum('PETROL', 'SPEED_PETROL', 'DIESEL', 'LUBRICANT', name='fueltype'), nullable=False),
            sa.Column('pipe_1_last_reading', sa.Float(), nullable=False),
            sa.Column('pipe_2_fuel_type', sa.Enum('PETROL', 'SPEED_PETROL', 'DIESEL', 'LUBRICANT', name='fueltype'), nullable=False),
            sa.Column('pipe_2_last_reading', sa.Float(), nullable=False),
            sa.Column('status', sa.Enum('ACTIVE', 'MAINTENANCE', 'OUT_OF_ORDER', name='nozzlestatus'), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_nozzles_id'), 'nozzles', ['id'], unique=False)
        op.create_index(op.f('ix_nozzles_uuid'), 'nozzles', ['uuid'], unique=True)

    # 2. Create nozzle_readings table
    if 'nozzle_readings' not in tables:
        op.create_table('nozzle_readings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('uuid', sa.String(length=36), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('nozzle_id', sa.Integer(), nullable=False),
            sa.Column('shift_id', sa.Integer(), nullable=True),
            sa.Column('reading_date', sa.Date(), nullable=False),
            sa.Column('pipe_1_opening', sa.Float(), nullable=False),
            sa.Column('pipe_1_closing', sa.Float(), nullable=False),
            sa.Column('pipe_1_sales', sa.Float(), nullable=False),
            sa.Column('pipe_2_opening', sa.Float(), nullable=False),
            sa.Column('pipe_2_closing', sa.Float(), nullable=False),
            sa.Column('pipe_2_sales', sa.Float(), nullable=False),
            sa.Column('total_sales', sa.Float(), nullable=False),
            sa.Column('sales_amount', sa.Numeric(precision=10, scale=2), nullable=True),
            sa.ForeignKeyConstraint(['nozzle_id'], ['nozzles.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_nozzle_readings_id'), 'nozzle_readings', ['id'], unique=False)
        op.create_index(op.f('ix_nozzle_readings_uuid'), 'nozzle_readings', ['uuid'], unique=True)
        op.create_index(op.f('ix_nozzle_readings_reading_date'), 'nozzle_readings', ['reading_date'], unique=False)

    # 3. Modify vouchers table to add nozzle_id
    columns = [col['name'] for col in inspector.get_columns('vouchers')]
    if 'nozzle_id' not in columns:
        with op.batch_alter_table('vouchers') as batch_op:
            batch_op.add_column(sa.Column('nozzle_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_vouchers_nozzle_id', 'nozzles', ['nozzle_id'], ['id'], ondelete='SET NULL')
        op.create_index(op.f('ix_vouchers_nozzle_id'), 'vouchers', ['nozzle_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vouchers_nozzle_id'), table_name='vouchers')
    with op.batch_alter_table('vouchers') as batch_op:
        batch_op.drop_constraint('fk_vouchers_nozzle_id', type_='foreignkey')
        batch_op.drop_column('nozzle_id')
    op.drop_index(op.f('ix_nozzle_readings_reading_date'), table_name='nozzle_readings')
    op.drop_index(op.f('ix_nozzle_readings_uuid'), table_name='nozzle_readings')
    op.drop_index(op.f('ix_nozzle_readings_id'), table_name='nozzle_readings')
    op.drop_table('nozzle_readings')
    op.drop_index(op.f('ix_nozzles_uuid'), table_name='nozzles')
    op.drop_index(op.f('ix_nozzles_id'), table_name='nozzles')
    op.drop_table('nozzles')
