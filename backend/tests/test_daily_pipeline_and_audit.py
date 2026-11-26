from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_daily_pipeline_snapshot_audit_and_auto_balance(client, auth_headers):
    target = date.today() - timedelta(days=12)

    # Create a bank account
    ba = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC Main",
            "bank_name": "HDFC Bank",
            "account_type": "CURRENT",
            "opening_balance": "10000.00",
        },
    )
    assert ba.status_code == 201
    bank_uuid = ba.json()["uuid"]

    # Create a UPI voucher WITHOUT bank_account_uuid to trigger Point 5 in 5-Point Audit
    v = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"AUD-{target.strftime('%Y%m%d')}-1",
            "invoice_date": target.isoformat(),
            "payment_mode": "UPI",
            "fuel_type": "DIESEL",
            "quantity_liters": "10.00",
            "rate_per_liter": "90.00",
            "total_amount": "900.00",
        },
    )
    assert v.status_code == 201

    # Snapshot
    snap = client.get(
        f"{P}/pipeline/snapshot?target_date={target.isoformat()}",
        headers=auth_headers,
    )
    assert snap.status_code == 200, snap.text
    s_data = snap.json()
    assert s_data["vouchers"]["upi_sales"] == 900.0

    # 5-Point Audit should flag unlinked_bank_entries
    audit = client.get(
        f"{P}/pipeline/audit-5-point?target_date={target.isoformat()}",
        headers=auth_headers,
    )
    assert audit.status_code == 200
    a_data = audit.json()
    assert a_data["mismatch_count"] >= 1
    unlinked_check = next(c for c in a_data["checks"] if c["id"] == "unlinked_bank_entries")
    assert unlinked_check["status"] == "MISMATCH"

    # 1-Click Fix Legacy Entries
    fix = client.post(
        f"{P}/pipeline/fix-legacy",
        headers=auth_headers,
        json={"bank_account_uuid": bank_uuid, "on_date": target.isoformat()},
    )
    assert fix.status_code == 200
    assert fix.json()["fixed_count"] >= 1

    # Re-run 5-Point Audit -> unlinked_bank_entries should now be OK
    audit2 = client.get(
        f"{P}/pipeline/audit-5-point?target_date={target.isoformat()}",
        headers=auth_headers,
    )
    unlinked_check2 = next(
        c for c in audit2.json()["checks"] if c["id"] == "unlinked_bank_entries"
    )
    assert unlinked_check2["status"] == "OK"

    # Idempotency: running fix-legacy again must NOT double-credit bank
    fix2 = client.post(
        f"{P}/pipeline/fix-legacy",
        headers=auth_headers,
        json={"bank_account_uuid": bank_uuid, "on_date": target.isoformat()},
    )
    assert fix2.status_code == 200
    assert fix2.json()["fixed_count"] == 0
    accounts = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    acc = next(a for a in accounts if a["uuid"] == bank_uuid)
    assert Decimal(str(acc["current_balance"])) == Decimal("10900.00")


def test_pre_lock_check_books_health_timeline_and_daily_register_lock(client, auth_headers):
    target = date.today() - timedelta(days=15)

    # Pre-lock check
    plc = client.get(
        f"{P}/pipeline/pre-lock-check?target_date={target.isoformat()}",
        headers=auth_headers,
    )
    assert plc.status_code == 200
    assert len(plc.json()["checkpoints"]) == 4

    # Books health
    bh = client.get(f"{P}/pipeline/books-health", headers=auth_headers)
    assert bh.status_code == 200
    assert "issues" in bh.json()

    # Pre-export audit
    pea = client.get(
        f"{P}/pipeline/pre-export-audit?start_date={target.isoformat()}&end_date={target.isoformat()}",
        headers=auth_headers,
    )
    assert pea.status_code == 200
    assert "checks" in pea.json()

    # Timeline
    tl = client.get(
        f"{P}/pipeline/timeline?target_date={target.isoformat()}",
        headers=auth_headers,
    )
    assert tl.status_code == 200
    assert "events" in tl.json()

    # Close day and verify Daily Register is locked for that date
    close_resp = client.post(
        f"{P}/day-closings",
        headers=auth_headers,
        json={
            "closing_date": target.isoformat(),
            "notes_500": 4,
            "cash_to_next_day": "500.00",
        },
    )
    assert close_resp.status_code == 201

    # Attempting to upsert DailyCashSheet on locked date must return 423 (DayClosedError)
    sheet_resp = client.post(
        f"{P}/income/cash-sheet",
        headers=auth_headers,
        json={
            "sheet_date": target.isoformat(),
            "notes_500": 10,
            "notes_200": 0,
            "notes_100": 0,
            "notes_50": 0,
            "notes_20": 0,
            "notes_10": 0,
        },
    )
    assert sheet_resp.status_code in (400, 409, 423)
