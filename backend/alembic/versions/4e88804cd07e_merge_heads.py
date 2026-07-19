"""merge_heads

Revision ID: 4e88804cd07e
Revises: 0c4096ed4c2c, a1b2c3d4e5f6
Create Date: 2026-07-19 12:18:16.634402

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e88804cd07e'
down_revision: Union[str, Sequence[str], None] = ('0c4096ed4c2c', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
