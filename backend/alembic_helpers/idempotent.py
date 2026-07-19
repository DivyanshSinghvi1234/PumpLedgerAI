"""Idempotency helpers for Alembic migrations.

Prod DBs in this project were originally built by SQLAlchemy ``create_all`` plus
the manual ``init_db.check_and_update_schema()`` backfill, not by a linear
Alembic history. As a result, columns/tables a migration wants to add may
already exist. These helpers make additive migrations safe to re-run and safe
to roll forward over an already-partially-applied schema.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


def _inspector() -> sa.engine.reflection.Inspector:
    return sa.inspect(op.get_bind())


def has_table(table: str) -> bool:
    return table in _inspector().get_table_names()


def has_column(table: str, column: str) -> bool:
    if not has_table(table):
        return False
    return any(c["name"] == column for c in _inspector().get_columns(table))


def add_column_if_missing(table: str, column: sa.Column) -> None:
    if not has_column(table, column.name):
        op.add_column(table, column)


def drop_column_if_exists(table: str, column: str) -> None:
    if has_column(table, column):
        op.drop_column(table, column)


def has_fk(table: str, name: str) -> bool:
    if not has_table(table):
        return False
    return any(fk.get("name") == name for fk in _inspector().get_foreign_keys(table))


def has_index(table: str, name: str) -> bool:
    if not has_table(table):
        return False
    return any(ix.get("name") == name for ix in _inspector().get_indexes(table))
