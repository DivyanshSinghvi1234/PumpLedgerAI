#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Pre-start migration guard (Render deploy)
# ─────────────────────────────────────────────
# Prod was originally built by SQLAlchemy `create_all`, so its schema exists
# but there is no `alembic_version` row. Running `alembic upgrade head` blindly
# on such a DB would try to re-run the initial CREATE TABLE migration and fail.
#
# This script makes migration adoption idempotent:
#   - If the DB has never been stamped, stamp it at the merge point that
#     corresponds to the current create_all schema, so past migrations are
#     treated as already-applied.
#   - Then run `alembic upgrade head` so any FUTURE migrations apply cleanly.
#
# The additive-column backfill in init_db.check_and_update_schema() still runs
# at app startup as a belt-and-suspenders safety net for legacy prod columns.
set -euo pipefail

echo "[prestart] Checking Alembic migration state..."

# Has this DB ever been stamped by Alembic? (empty output => no version table/row)
CURRENT_REV="$(python -m alembic current 2>/dev/null | grep -oE '[0-9a-f]{12}' | head -1 || true)"

if [ -z "${CURRENT_REV}" ]; then
  # create_all-built DB with schema already at (or ahead of) the merge point.
  # Stamp the pre-merge revision so both historical branches are considered
  # applied, then upgrade will roll forward through the merge + anything newer.
  echo "[prestart] No Alembic version found — adopting existing schema (stamp b5b1be8b0476)."
  python -m alembic stamp b5b1be8b0476
else
  echo "[prestart] DB already at revision ${CURRENT_REV}."
fi

echo "[prestart] Applying migrations (alembic upgrade head)..."
python -m alembic upgrade head

echo "[prestart] Migration check complete."
