from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: int
    actor_id: int | None = None
    actor_name: str | None = None
    action: str
    target_table: str
    target_id: str
    changes_json: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
