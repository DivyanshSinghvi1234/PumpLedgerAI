"""add_reading_times_and_interim_6am_to_nozzle_readings

Revision ID: 84afd97faf4a
Revises: 4e88804cd07e
Create Date: 2026-07-19 12:18:27.539640

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from alembic_helpers.idempotent import add_column_if_missing, drop_column_if_exists


# revision identifiers, used by Alembic.
revision: str = '84afd97faf4a'
down_revision: Union[str, Sequence[str], None] = '4e88804cd07e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add reading timestamps and optional 6 AM interim reading to nozzle_readings."""
    add_column_if_missing('nozzle_readings', sa.Column('opening_time', sa.Time(), nullable=True))
    add_column_if_missing('nozzle_readings', sa.Column('closing_time', sa.Time(), nullable=True))
    add_column_if_missing('nozzle_readings', sa.Column('interim_6am_reading', sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove reading timestamps and interim reading from nozzle_readings."""
    drop_column_if_exists('nozzle_readings', 'interim_6am_reading')
    drop_column_if_exists('nozzle_readings', 'closing_time')
    drop_column_if_exists('nozzle_readings', 'opening_time')
