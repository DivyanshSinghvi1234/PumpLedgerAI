import json
from datetime import date
import pytest

P = "/api/v1"


def test_audit_log_manual_payment_allocation(client, auth_headers, customer):
    """Manual payment allocation should create an audit log entry in payments table."""
    cust_uuid = customer["uuid"]

    # 1. Create a credit voucher
    v_resp = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": "INV-AUDIT-001",
            "invoice_date": date.today().isoformat(),
            "customer_uuid": cust_uuid,
            "fuel_type": "DIESEL",
            "quantity_liters": "100.0",
            "rate_per_liter": "10.00",
            "total_amount": "1000.00",
            "payment_mode": "CREDIT",
        },
    )
    assert v_resp.status_code == 201, v_resp.text
    voucher = v_resp.json()

    # 2. Allocate payment manually
    alloc_resp = client.post(
        f"{P}/payments/allocate",
        headers=auth_headers,
        json={
            "customer_uuid": cust_uuid,
            "amount": "1000.00",
            "payment_mode": "UPI",
            "payment_date": date.today().isoformat(),
            "allocations": [
                {"voucher_uuid": voucher["uuid"], "amount": "1000.00"},
            ],
        },
    )
    assert alloc_resp.status_code == 201, alloc_resp.text
    payment = alloc_resp.json()

    # 3. Retrieve audit logs and verify entry for payment allocation
    logs_resp = client.get(f"{P}/audit-logs", headers=auth_headers)
    assert logs_resp.status_code == 200, logs_resp.text
    logs = logs_resp.json()

    matched = [
        log for log in logs
        if log.get("target_table") == "payments"
        and ("Allocation" in log.get("action", "") or "Settlement" in log.get("action", ""))
    ]
    assert len(matched) > 0, "No audit log entry found for manual payment allocation"
    log_row = matched[0]
    changes = json.loads(log_row["changes_json"]) if log_row.get("changes_json") else {}
    after = changes.get("after", {})
    assert after.get("customer_id") is not None
    assert float(after.get("amount", 0)) == 1000.00


def test_audit_log_ledger_adjustment(client, auth_headers, customer):
    """Posting ledger debit and credit adjustments should record audit log entries in ledger_entries."""
    cust_uuid = customer["uuid"]

    # 1. Post a Debit Adjustment
    debit_resp = client.post(
        f"{P}/customers/{cust_uuid}/ledger/adjustments",
        headers=auth_headers,
        json={
            "entry_type": "DEBIT_ADJUSTMENT",
            "amount": "250.00",
            "entry_date": date.today().isoformat(),
            "remarks": "Penalty charge for late payment",
        },
    )
    assert debit_resp.status_code == 201, debit_resp.text

    # 2. Post a Credit Adjustment
    credit_resp = client.post(
        f"{P}/customers/{cust_uuid}/ledger/adjustments",
        headers=auth_headers,
        json={
            "entry_type": "CREDIT_ADJUSTMENT",
            "amount": "50.00",
            "entry_date": date.today().isoformat(),
            "remarks": "Goodwill discount credit",
        },
    )
    assert credit_resp.status_code == 201, credit_resp.text

    # 3. Retrieve audit logs and verify entries
    logs_resp = client.get(f"{P}/audit-logs", headers=auth_headers)
    assert logs_resp.status_code == 200, logs_resp.text
    logs = logs_resp.json()

    debit_logs = [
        log for log in logs
        if log.get("target_table") == "ledger_entries"
        and log.get("action") == "Posted Debit Adjustment"
    ]
    credit_logs = [
        log for log in logs
        if log.get("target_table") == "ledger_entries"
        and log.get("action") == "Posted Credit Adjustment"
    ]

    assert len(debit_logs) > 0, "No audit log entry found for Posted Debit Adjustment"
    assert len(credit_logs) > 0, "No audit log entry found for Posted Credit Adjustment"

    debit_after = json.loads(debit_logs[0]["changes_json"]).get("after", {})
    credit_after = json.loads(credit_logs[0]["changes_json"]).get("after", {})

    assert debit_after.get("entry_type") == "DEBIT_ADJUSTMENT"
    assert credit_after.get("entry_type") == "CREDIT_ADJUSTMENT"


def test_audit_log_tank_soft_delete(client, auth_headers):
    """Soft-deleting a fuel tank should record an audit log entry in fuel_tanks."""
    # 1. Create a tank
    create_resp = client.post(
        f"{P}/tanks",
        headers=auth_headers,
        json={
            "name": "Audit Test Tank",
            "fuel_type": "DIESEL",
            "capacity_liters": 15000.0,
            "current_stock_liters": 8000.0,
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    tank = create_resp.json()
    tank_uuid = tank["uuid"]

    # 2. Soft-delete the tank
    del_resp = client.delete(f"{P}/tanks/{tank_uuid}", headers=auth_headers)
    assert del_resp.status_code == 204, del_resp.text

    # 3. Retrieve audit logs and verify deletion entry
    logs_resp = client.get(f"{P}/audit-logs", headers=auth_headers)
    assert logs_resp.status_code == 200, logs_resp.text
    logs = logs_resp.json()

    matched = [
        log for log in logs
        if log.get("target_table") == "fuel_tanks"
        and log.get("action") == "Deleted Fuel Tank"
    ]
    assert len(matched) > 0, "No audit log entry found for Deleted Fuel Tank"
    log_row = matched[0]
    changes = json.loads(log_row["changes_json"]) if log_row.get("changes_json") else {}
    before = changes.get("before", {})

    assert before.get("name") == "Audit Test Tank"
    assert before.get("fuel_type") == "DIESEL"
