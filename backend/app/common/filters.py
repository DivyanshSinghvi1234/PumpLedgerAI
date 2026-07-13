from __future__ import annotations

from fastapi import Query


def pagination_params():

    return {
        "page": Query(
            1,
            ge=1,
        ),
        "page_size": Query(
            20,
            ge=1,
            le=100,
        ),
    }