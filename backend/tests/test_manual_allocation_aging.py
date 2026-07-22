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
    d = (date.today() - timedelta(days=days_ago)).isoformat()
    r = client.post(
        f"{P}/vouchers",
        headers=H,
        json={
            "invoice_number": invoice_no,
            "invoice_date": d,
            "customer_uuid": cust_uuid,
            "fuel_type": "DIESEL",
            "quantity_liters": str(float(amount) / 10.0),
            "rate_per_liter": "10",
            "total_amount": str(amount),
            "payment_mode": "CREDIT",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_manual_allocation_endpoint_validations(H, client):
    # Create customer
    r = client.post(
        f"{P}/customers",
        headers=H,
        json={"name": "Reconcile Test Ltd", "opening_balance": "0.00"},
    )
    assert r.status_code == 201, r.text
    cust = r.json()
    cust_uuid = cust["uuid"]

    # Create credit vouchers
    v1 = _credit_voucher(client, H, cust_uuid, "REC-INV-1", 5, "1000.00")
    v2 = _credit_voucher(client, H, cust_uuid, "REC-INV-2", 20, "2000.00")

    # 1. Mismatch: sum of allocations (400 + 400 = 800) does not match total amount (1000)
    r = client.post(
        f"{P}/payments/allocate",
        headers=H,
        json={
            "customer_uuid": cust_uuid,
            "amount": "1000.00",
            "payment_mode": "UPI",
            "payment_date": date.today().isoformat(),
            "allocations": [
                {"voucher_uuid": v1["uuid"], "amount": "400.00"},
                {"voucher_uuid": v2["uuid"], "amount": "400.00"},
            ],
        },
    )
    assert r.status_code == 400, r.text
    assert "does not equal the payment amount" in r.json()["detail"]

    # 2. Exceeds: single allocation (1100) exceeds balance due (1000)
    r = client.post(
        f"{P}/payments/allocate",
        headers=H,
        json={
            "customer_uuid": cust_uuid,
            "amount": "1500.00",
            "payment_mode": "CASH",
            "payment_date": date.today().isoformat(),
            "allocations": [
                {"voucher_uuid": v1["uuid"], "amount": "1100.00"},
                {"voucher_uuid": v2["uuid"], "amount": "400.00"},
            ],
        },
    )
    assert r.status_code == 400, r.text
    assert "exceeds the balance due" in r.json()["detail"]

    # 3. Successful allocation: sum of allocations (400 + 600 = 1000) == amount (1000)
    r = client.post(
        f"{P}/payments/allocate",
        headers=H,
        json={
            "customer_uuid": cust_uuid,
            "amount": "1000.00",
            "payment_mode": "CARD",
            "payment_date": date.today().isoformat(),
            "allocations": [
                {"voucher_uuid": v1["uuid"], "amount": "400.00"},
                {"voucher_uuid": v2["uuid"], "amount": "600.00"},
            ],
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert float(data["amount"]) == 1000.00

    # Fetch updated vouchers to confirm allocations are applied
    r = client.get(f"{P}/vouchers/{v1['uuid']}", headers=H)
    assert r.status_code == 200
    assert float(r.json()["balance_due"]) == 600.00
    assert float(r.json()["amount_paid"]) == 400.00

    r = client.get(f"{P}/vouchers/{v2['uuid']}", headers=H)
    assert r.status_code == 200
    assert float(r.json()["balance_due"]) == 1400.00
    assert float(r.json()["amount_paid"]) == 600.00


def test_analytics_debtor_aging_endpoint(H, client):
    # Create customer
    r = client.post(
        f"{P}/customers",
        headers=H,
        json={"name": "Aging Analytics Fleet", "opening_balance": "0.00"},
    )
    assert r.status_code == 201, r.text
    cust = r.json()
    cust_uuid = cust["uuid"]

    # Invoices in buckets
    _credit_voucher(client, H, cust_uuid, "AG-AN-10", 10, "500.00")   # 0-15 days
    _credit_voucher(client, H, cust_uuid, "AG-AN-25", 25, "1000.00")  # 15-30 days
    _credit_voucher(client, H, cust_uuid, "AG-AN-50", 50, "1500.00")  # 30-60 days
    _credit_voucher(client, H, cust_uuid, "AG-AN-75", 75, "2000.00")  # 60+ days

    r = client.get(f"{P}/analytics/debtor-aging", headers=H)
    assert r.status_code == 200, r.text
    res = r.json()

    # Assert totals
    totals = res["totals"]
    assert float(totals["bucket_0_15"]) >= 500.00
    assert float(totals["bucket_15_30"]) >= 1000.00
    assert float(totals["bucket_30_60"]) >= 1500.00
    assert float(totals["bucket_60_plus"]) >= 2000.00
    assert float(totals["total_outstanding"]) >= 5000.00

    # Assert client outline lists late invoices
    cust_row = next(c for c in res["customers"] if c["customer_uuid"] == cust_uuid)
    assert cust_row["customer_name"] == "Aging Analytics Fleet"
    assert len(cust_row["invoices"]) == 4

    invoices = cust_row["invoices"]
    inv_10 = next(i for i in invoices if i["invoice_number"] == "AG-AN-10")
    assert inv_10["age_days"] == 10
    assert float(inv_10["balance_due"]) == 500.00
