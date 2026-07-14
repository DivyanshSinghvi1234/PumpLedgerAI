from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.repositories.base_repository import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):

    def __init__(self):
        super().__init__(AuditLog)

    def get_logs_for_target(
        self,
        db: Session,
        target_table: str,
        target_id: str,
    ) -> list[AuditLog]:
        return list(
            db.scalars(
                select(AuditLog)
                .where(
                    AuditLog.target_table == target_table,
                    AuditLog.target_id == target_id
                )
                .order_by(AuditLog.created_at.desc())
            ).all()
        )
