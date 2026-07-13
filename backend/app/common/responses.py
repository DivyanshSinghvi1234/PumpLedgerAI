from __future__ import annotations

from typing import Generic
from typing import TypeVar

from pydantic import BaseModel
from pydantic import ConfigDict

from app.common.pagination import PaginationResponse

T = TypeVar("T")


class PaginatedResponse(
    BaseModel,
    Generic[T],
):
    items: list[T]

    pagination: PaginationResponse

    model_config = ConfigDict(
        frozen=True,
    )


class MessageResponse(BaseModel):
    message: str