"""Regression tests for the Debtor Aging report (Feature 1).

Ages each customer's OPEN invoice balances by invoice_date into
0-15 / 16-30 / 31-60 / 60+ day buckets. Pure computation over vouchers.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

P = "/api/v1"


@pytest.fixture
def H(client):
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


def _credit_voucher(client, H, cust_uuid, invoice_no, days_ago, amount):
    """A CREDIT voucher dated `days_ago` days in the past → open balance."""
    d = (date.today() - timedelta(days=days_ago)).isoformat()
    r = client.post(
        f"{P}/vouchers",
        headers=H,
        json={
            "invoice_number": invoice_no,
            "invoice_date": d,
            "customer_uuid": cust_uuid,
            "fuel_type": "DIESEL",
            "quantity_liters": "10",
            "rate_per_liter": "50",
            "total_amount": str(amount),
            "payment_mode": "CREDIT",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_debtor_aging_buckets(H, client):
    # A dedicated customer so the assertions are isolated from other tests.
    r = client.post(
        f"{P}/customers",
        headers=H,
        json={"name": "Aging Test Fleet", "opening_balance": "0.00"},
    )
    assert r.status_code == 201, r.text
    cust = r.json()
    uuid = cust["uuid"]

    # Four open credit vouchers, one per bucket.
    _credit_voucher(client, H, uuid, "AGE-5", 5, "100")     # 0-15
    _credit_voucher(client, H, uuid, "AGE-20", 20, "200")   # 16-30
    _credit_voucher(client, H, uuid, "AGE-45", 45, "400")   # 31-60
    _credit_voucher(client, H, uuid, "AGE-90", 90, "800")   # 60+

    r = client.get(f"{P}/reports/debtor-aging", headers=H)
    assert r.status_code == 200, r.text
    report = r.json()

    row = next(x for x in report["rows"] if x["customer_uuid"] == uuid)
    assert row["bucket_0_15"] == "100.00"
    assert row["bucket_16_30"] == "200.00"
    assert row["bucket_31_60"] == "400.00"
    assert row["bucket_60_plus"] == "800.00"
    assert row["total_outstanding"] == "1500.00"


def test_debtor_aging_excludes_paid_and_walkin(H, client):
    # A cash walk-in voucher (no customer, fully paid) must NOT appear.
    d = date.today().isoformat()
    r = client.post(
        f"{P}/vouchers",
        headers=H,
        json={
            "invoice_number": "AGE-CASH",
            "invoice_date": d,
            "customer_name": "Walk In",
            "fuel_type": "PETROL",
            "quantity_liters": "5",
            "rate_per_liter": "100",
            "total_amount": "500",
            "payment_mode": "CASH",
        },
    )
    assert r.status_code == 201, r.text

    r = client.get(f"{P}/reports/debtor-aging", headers=H)
    assert r.status_code == 200
    # Walk-in has no customer_uuid — no debtor row should carry a null uuid.
    assert all(row["customer_uuid"] for row in r.json()["rows"])


def test_debtor_aging_csv_export(H, client):
    r = client.get(f"{P}/reports/debtor-aging/export", headers=H)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/csv")
