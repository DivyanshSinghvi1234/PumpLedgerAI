"""add_tally_godown_name

Revision ID: bc2ec109d26f
Revises: d8e9f0a1b2c3
Create Date: 2026-07-21 23:37:02.347269

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc2ec109d26f'
down_revision: Union[str, Sequence[str], None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('fuel_tanks', sa.Column('tally_godown_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('fuel_tanks', 'tally_godown_name')
