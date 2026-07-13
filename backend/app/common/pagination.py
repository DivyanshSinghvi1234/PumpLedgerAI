from __future__ import annotations

from math import ceil

from pydantic import BaseModel, ConfigDict


class PaginationResponse(BaseModel):
    page: int
    page_size: int

    total_items: int
    total_pages: int

    has_next: bool
    has_previous: bool

    model_config = ConfigDict(
        frozen=True,
    )


def build_pagination(
    *,
    page: int,
    page_size: int,
    total_items: int,
) -> PaginationResponse:

    total_pages = (
        ceil(total_items / page_size)
        if page_size > 0
        else 1
    )

    return PaginationResponse(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )