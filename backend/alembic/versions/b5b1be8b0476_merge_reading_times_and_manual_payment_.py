"""merge reading_times and manual_payment_mode heads

Revision ID: b5b1be8b0476
Revises: 84afd97faf4a, b27f0d5e08b1
Create Date: 2026-07-20 00:02:59.191358

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5b1be8b0476'
down_revision: Union[str, Sequence[str], None] = ('84afd97faf4a', 'b27f0d5e08b1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
