import pytest
from datetime import date
from app.core.security import hash_password
from app.models.user import User
from app.models.user_pump_access import UserPumpAccess
from app.core.enums import UserRole, FuelType

@pytest.fixture
def operator_headers(client, db_session):
    # Create operator user if not exists
    username = "test_op"
    op_user = db_session.query(User).filter(User.username == username).first()
    if not op_user:
        op_user = User(
            username=username,
            full_name="Test Operator",
            password_hash=hash_password("operator123"),
            role=UserRole.OPERATOR,
            is_active=True,
        )
        db_session.add(op_user)
        db_session.commit()
        db_session.refresh(op_user)
        
    # Give access to pump SVF
    from app.models.pump import Pump
    pump = db_session.query(Pump).filter(Pump.code == "SVF").first()
    if pump:
        access = db_session.query(UserPumpAccess).filter(
            UserPumpAccess.user_id == op_user.id,
            UserPumpAccess.pump_id == pump.id
        ).first()
        if not access:
            access = UserPumpAccess(user_id=op_user.id, pump_id=pump.id)
            db_session.add(access)
            db_session.commit()
            
    # Login
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "operator123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    if pump:
        headers["X-Pump-UUID"] = pump.uuid
    return headers


class TestRolePermissions:

    def test_operator_read_only_access(self, client, operator_headers):
        # 1. Nozzles Readings Bulk Form (GET) - Should be accessible
        resp = client.get(
            "/api/v1/nozzles/readings/bulk-form?reading_date=2026-07-20",
            headers=operator_headers,
        )
        assert resp.status_code == 200

        # 2. Price Schedules Active Rate (GET) - Should be accessible
        resp = client.get(
            "/api/v1/price-schedules/active-rate?fuel_type=PETROL",
            headers=operator_headers,
        )
        # Could be 404 if no rate scheduled, but must not be 403
        assert resp.status_code in (200, 404)

        # 3. Fuel Tanks List (GET) - Should be accessible
        resp = client.get(
            "/api/v1/tanks",
            headers=operator_headers,
        )
        assert resp.status_code == 200

        # 4. Customers List (GET) - Should be accessible
        resp = client.get(
            "/api/v1/customers",
            headers=operator_headers,
        )
        assert resp.status_code == 200

    def test_operator_write_denied(self, client, operator_headers):
        # 1. Post Bulk Readings (POST) - Should be forbidden (403)
        resp = client.post(
            "/api/v1/nozzles/readings/bulk",
            headers=operator_headers,
            json={
                "reading_date": "2026-07-20",
                "readings": []
            }
        )
        assert resp.status_code == 403

        # 2. Post Price Schedule (POST) - Should be forbidden (403)
        resp = client.post(
            "/api/v1/price-schedules",
            headers=operator_headers,
            json={
                "fuel_type": "PETROL",
                "rate": "100.00",
                "effective_from": "2026-07-20T06:00:00"
            }
        )
        assert resp.status_code == 403

    def test_admin_manager_write_allowed(self, client, auth_headers):
        # Admin should be allowed (will return validation error 422/400 instead of 403 auth error)
        resp = client.post(
            "/api/v1/price-schedules",
            headers=auth_headers,
            json={
                "fuel_type": "INVALID_FUEL_TYPE",
            }
        )
        assert resp.status_code != 403
