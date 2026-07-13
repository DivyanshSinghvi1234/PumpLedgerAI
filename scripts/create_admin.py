"""Manually (re)create the default admin user.

Usage (from the backend/ directory):

    python ../scripts/create_admin.py

The admin credentials are read from settings (DEFAULT_ADMIN_*).
Safe to run repeatedly: it will not create a duplicate if the user exists.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running the script from anywhere by adding backend/ to the path.
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.database.init_db import init_db  # noqa: E402


def main() -> None:
    init_db()
    print("Database initialized and default admin ensured.")


if __name__ == "__main__":
    main()
