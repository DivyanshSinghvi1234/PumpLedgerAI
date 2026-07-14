from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.audit_log import AuditLogResponse
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["Audit Trails"])


@router.get(
    "",
    response_model=list[AuditLogResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def list_audit_logs(
    db: Session = Depends(get_db),
):
    # Fetch audit logs sorted by newest first
    return list(
        db.scalars(
            select(AuditLog).order_by(AuditLog.created_at.desc())
        ).all()
    )
