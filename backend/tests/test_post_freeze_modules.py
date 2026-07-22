"""Regression coverage for modules that shipped after the Phase 8 MVP freeze
and were never exercised by _e2e_smoke.py: employees, shifts (start/end +
variance), and the audit-log viewer.

These backends were built with complete APIs; employees + shifts have no
frontend caller yet, so tests are the only thing standing on them.
"""
from __future__ import annotations

import pytest


P = "/api/v1"


@pytest.fixture
def H(client):
    """Admin auth headers with an active pump (mirrors conftest.auth_headers)."""
    r = client.post(
        f"{P}/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    pumps = client.get(
        f"{P}/pumps", headers={"Authorization": f"Bearer {token}"}
    ).json()
    headers = {"Authorization": f"Bearer {token}"}
    if pumps:
        headers["X-Pump-UUID"] = pumps[0]["uuid"]
    return headers


# ---------------------------------------------------------------- Employees
def test_employee_crud(H, client):
    # Create
    r = client.post(
        f"{P}/employees",
        headers=H,
        json={"full_name": "Ravi Attendant", "phone": "9990001111", "role": "OPERATOR"},
    )
    assert r.status_code == 201, r.text
    emp = r.json()
    assert emp["full_name"] == "Ravi Attendant"
    assert emp["is_active"] is True
    uuid = emp["uuid"]

    # List includes it
    r = client.get(f"{P}/employees", headers=H)
    assert r.status_code == 200
    assert any(e["uuid"] == uuid for e in r.json())

    # Update
    r = client.put(f"{P}/employees/{uuid}", headers=H, json={"phone": "8887776666"})
    assert r.status_code == 200, r.text
    assert r.json()["phone"] == "8887776666"

    # Duplicate email → 409
    client.post(f"{P}/employees", headers=H, json={"full_name": "A", "email": "dup@x.com"})
    r = client.post(f"{P}/employees", headers=H, json={"full_name": "B", "email": "dup@x.com"})
    assert r.status_code == 409, r.text

    # Soft delete → gone from active list
    r = client.delete(f"{P}/employees/{uuid}", headers=H)
    assert r.status_code == 204, r.text
    r = client.get(f"{P}/employees", headers=H)
    assert not any(e["uuid"] == uuid for e in r.json())


def test_attendants_reflect_real_employees(H, client):
    """Once a real employee exists, /shifts/attendants drops the hardcoded fallback."""
    client.post(
        f"{P}/employees",
        headers=H,
        json={"full_name": "Unique Attendant Name", "role": "OPERATOR"},
    )
    r = client.get(f"{P}/shifts/attendants", headers=H)
    assert r.status_code == 200, r.text
    names = r.json()
    assert "Unique Attendant Name" in names
    assert "Ramesh Kumar" not in names  # fallback suppressed when real data exists


# ------------------------------------------------------------------- Shifts
def test_shift_start_end_and_variance(H, client):
    # Need an employee to attach the shift to.
    r = client.post(
        f"{P}/employees", headers=H, json={"full_name": "Shift Worker", "role": "OPERATOR"}
    )
    assert r.status_code == 201, r.text
    emp_uuid = r.json()["uuid"]

    # No active shift initially
    r = client.get(f"{P}/shifts/active", headers=H)
    assert r.status_code == 200

    # Start
    r = client.post(
        f"{P}/shifts/start",
        headers=H,
        json={"employee_uuid": emp_uuid, "opening_cash": "500.00"},
    )
    assert r.status_code == 201, r.text
    shift = r.json()
    assert shift["opening_cash"] == "500.00"
    assert shift["employee"]["uuid"] == emp_uuid

    # Active shift now returned
    r = client.get(f"{P}/shifts/active", headers=H)
    assert r.status_code == 200 and r.json() is not None

    # End with a reported cash figure → variance computed (no sales in window).
    r = client.post(
        f"{P}/shifts/end", headers=H, json={"closing_cash_reported": "500.00"}
    )
    assert r.status_code == 200, r.text
    ended = r.json()
    assert ended["end_time"] is not None
    assert ended["cash_reconciled"] is True
    # opening 500, no sales, reported 500 → expected 500 → variance 0.
    assert ended["variance"] == "0.00", ended.get("variance")


# --------------------------------------------------------------- Audit log
def test_audit_log_records_mutations(H, client):
    """Creating an employee should leave an audit trail row."""
    client.post(
        f"{P}/employees",
        headers=H,
        json={"full_name": "Audited Person", "role": "OPERATOR"},
    )
    r = client.get(f"{P}/audit-logs", headers=H)
    assert r.status_code == 200, r.text
    logs = r.json()
    assert isinstance(logs, list) and len(logs) > 0
    # Each row carries the mutation shape the viewer renders.
    row = logs[0]
    assert "action" in row and "target_table" in row
