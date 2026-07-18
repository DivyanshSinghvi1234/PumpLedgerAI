from __future__ import annotations

import re

_VEHICLE_STRIP = re.compile(r"[\s\-.]+")


def normalize_vehicle_number(raw: str | None) -> str | None:
    """Canonicalize a vehicle number for matching.

    Indian plates are typed inconsistently across attendants —
    ``MP09 CD 1234``, ``mp-09-cd-1234`` and ``MP09CD1234`` all refer to the
    same vehicle. We uppercase and strip spaces, hyphens and dots so a single
    vehicle's history never fragments across near-duplicate records.

    Returns ``None`` for empty/whitespace-only input so callers can treat it
    as "no vehicle".
    """
    if raw is None:
        return None

    normalized = _VEHICLE_STRIP.sub("", raw).upper()

    return normalized or None
