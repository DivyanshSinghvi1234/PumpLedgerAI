from __future__ import annotations

import json
from typing import Any
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.repositories.audit_log_repository import AuditLogRepository


class AuditLogService:

    def __init__(self):
        self.repository = AuditLogRepository()

    def log_action(
        self,
        db: Session,
        action: str,
        target_table: str,
        target_id: str,
        actor_id: int | None = None,
        old_values: dict[str, Any] | None = None,
        new_values: dict[str, Any] | None = None,
    ) -> AuditLog:
        changes = None
        if old_values or new_values:
            changes = json.dumps({
                "before": old_values or {},
                "after": new_values or {}
            }, default=str)

        log = AuditLog(
            actor_id=actor_id,
            action=action,
            target_table=target_table,
            target_id=target_id,
            changes_json=changes,
        )
        return self.repository.create(db, log)

    def get_logs_for_target(
        self,
        db: Session,
        target_table: str,
        target_id: str,
    ) -> list[AuditLog]:
        return self.repository.get_logs_for_target(db, target_table, target_id)
