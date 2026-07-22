"""Regression tests for multi-tenant pump scoping.

Covers the fail-closed fix: a request that reads pump-scoped data without a
resolvable X-Pump-UUID must be refused (400), not served cross-pump rows.
Also asserts positive isolation: data created under one pump is invisible
under another.
"""
from __future__ import annotations

import pytest


def _login(client) -> str:
    r = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _pumps(client, token) -> list[dict]:
    r = client.get(
        "/api/v1/pumps", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    pumps = r.json()
    assert len(pumps) >= 2, "seed must provide >=2 pumps for isolation test"
    return pumps


def test_scoped_read_without_pump_header_is_refused(client):
    """Token present, X-Pump-UUID absent → 400, NOT unfiltered data."""
    token = _login(client)
    r = client.get(
        "/api/v1/customers",
        headers={"Authorization": f"Bearer {token}"},  # no X-Pump-UUID
    )
    assert r.status_code == 400, (r.status_code, r.text)
    assert "pump" in r.json()["detail"].lower()


def test_scoped_read_with_unknown_pump_header_is_refused(client):
    """A bogus pump UUID resolves to no pump → still fail closed (400)."""
    token = _login(client)
    r = client.get(
        "/api/v1/customers",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Pump-UUID": "does-not-exist",
        },
    )
    assert r.status_code == 400, (r.status_code, r.text)


def test_unscoped_read_without_pump_header_still_works(client):
    """/pumps is not pump-scoped, so it must NOT be caught by the guard."""
    token = _login(client)
    r = client.get(
        "/api/v1/pumps", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text


def test_pump_isolation(client):
    """A customer created under pump A is invisible under pump B."""
    token = _login(client)
    pumps = _pumps(client, token)
    pa, pb = pumps[0]["uuid"], pumps[1]["uuid"]

    ha = {"Authorization": f"Bearer {token}", "X-Pump-UUID": pa}
    hb = {"Authorization": f"Bearer {token}", "X-Pump-UUID": pb}

    r = client.post(
        "/api/v1/customers",
        headers=ha,
        json={"name": "Pump-A Only Customer", "opening_balance": "0.00"},
    )
    assert r.status_code == 201, r.text
    created_uuid = r.json()["uuid"]

    # Visible under pump A
    names_a = [c["name"] for c in client.get("/api/v1/customers", headers=ha).json()["items"]]
    assert "Pump-A Only Customer" in names_a

    # Invisible under pump B — list and direct fetch
    names_b = [c["name"] for c in client.get("/api/v1/customers", headers=hb).json()["items"]]
    assert "Pump-A Only Customer" not in names_b

    r = client.get(f"/api/v1/customers/{created_uuid}", headers=hb)
    assert r.status_code == 404, (r.status_code, r.text)


def test_audit_log_isolation(client):
    """Audit rows written under pump A must not appear under pump B."""
    token = _login(client)
    pumps = _pumps(client, token)
    pa, pb = pumps[0]["uuid"], pumps[1]["uuid"]

    ha = {"Authorization": f"Bearer {token}", "X-Pump-UUID": pa}
    hb = {"Authorization": f"Bearer {token}", "X-Pump-UUID": pb}

    # A mutation under pump A leaves an audit row stamped to pump A.
    r = client.post(
        "/api/v1/employees",
        headers=ha,
        json={"full_name": "Audit Isolation Worker", "role": "OPERATOR"},
    )
    assert r.status_code == 201, r.text

    logs_a = client.get("/api/v1/audit-logs", headers=ha).json()
    logs_b = client.get("/api/v1/audit-logs", headers=hb).json()

    def _mentions(logs):
        return any(l.get("target_table") == "employees" for l in logs)

    assert _mentions(logs_a), "pump A should see its own audit rows"
    # Pump B must not see pump A's employee-creation audit row.
    a_ids = {l["id"] for l in logs_a if l.get("target_table") == "employees"}
    b_ids = {l["id"] for l in logs_b}
    assert a_ids.isdisjoint(b_ids), "pump B leaked pump A's audit rows"
