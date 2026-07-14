"""add_pumps_and_user_pump_access

Revision ID: e27956422552
Revises: 19086f02fb98
Create Date: 2026-07-14 23:15:56.829077

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e27956422552'
down_revision: Union[str, Sequence[str], None] = '19086f02fb98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('pumps',
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('code', sa.String(length=20), nullable=False),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('uuid', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_pumps_code'), 'pumps', ['code'], unique=True)
    op.create_index(op.f('ix_pumps_id'), 'pumps', ['id'], unique=False)
    op.create_index(op.f('ix_pumps_uuid'), 'pumps', ['uuid'], unique=True)
    op.create_table('user_pump_access',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('pump_id', sa.Integer(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['pump_id'], ['pumps.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'pump_id', name='uq_user_pump')
    )
    op.create_index(op.f('ix_user_pump_access_id'), 'user_pump_access', ['id'], unique=False)
    op.create_index(op.f('ix_user_pump_access_pump_id'), 'user_pump_access', ['pump_id'], unique=False)
    op.create_index(op.f('ix_user_pump_access_user_id'), 'user_pump_access', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_user_pump_access_user_id'), table_name='user_pump_access')
    op.drop_index(op.f('ix_user_pump_access_pump_id'), table_name='user_pump_access')
    op.drop_index(op.f('ix_user_pump_access_id'), table_name='user_pump_access')
    op.drop_table('user_pump_access')
    op.drop_index(op.f('ix_pumps_uuid'), table_name='pumps')
    op.drop_index(op.f('ix_pumps_id'), table_name='pumps')
    op.drop_index(op.f('ix_pumps_code'), table_name='pumps')
    op.drop_table('pumps')
