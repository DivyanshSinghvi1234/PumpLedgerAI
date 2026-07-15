from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.audit_log import AuditLogResponse
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["Audit Trails"])


@router.get(
    "",
    response_model=list[AuditLogResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def list_audit_logs(
    db: Session = Depends(get_db),
):
    # Join with users to resolve actor username
    stmt = (
        select(AuditLog, User.username)
        .outerjoin(User, AuditLog.actor_id == User.id)
        .order_by(AuditLog.created_at.desc())
    )
    rows = db.execute(stmt).all()

    results = []
    for log, username in rows:
        resp = AuditLogResponse.model_validate(log)
        resp.actor_name = username
        results.append(resp)
    return results
