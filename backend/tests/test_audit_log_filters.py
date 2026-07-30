import pytest
from app.models.pump import Pump
from app.models.audit_log import AuditLog
from app.services.audit_log_service import AuditLogService
from sqlalchemy import select


def test_audit_log_target_filtering(db_session):
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test Audit Pump", code="TST-AUD", address="Test Address")
        db_session.add(pump)
        db_session.flush()

    audit_service = AuditLogService()

    # Log two distinct actions
    audit_service.log_action(
        db_session,
        action="Created Customer",
        target_table="customers",
        target_id="cust-123",
        new_values={"name": "Alice Transport"},
    )
    audit_service.log_action(
        db_session,
        action="Created Voucher",
        target_table="vouchers",
        target_id="vouch-999",
        new_values={"amount": "5000.0"},
    )

    # Query filtered by target_table & target_id
    stmt = select(AuditLog).where(
        AuditLog.target_table == "customers",
        AuditLog.target_id == "cust-123",
    )
    logs = db_session.scalars(stmt).all()

    assert len(logs) == 1
    assert logs[0].action == "Created Customer"
    assert logs[0].target_id == "cust-123"
