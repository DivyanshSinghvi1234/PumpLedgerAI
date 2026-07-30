import pytest


def test_pump_settings_api(client, auth_headers):
    # 1. GET non-existent setting returns null value
    res = client.get("/api/v1/settings/tally_ledger_mappings", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["key"] == "tally_ledger_mappings"
    assert data["value"] is None

    # 2. POST to save setting
    payload = {"value": {"cash_ledger": "Custom Cash A/c", "upi_ledger": "HDFC UPI"}}
    save_res = client.post(
        "/api/v1/settings/tally_ledger_mappings",
        headers=auth_headers,
        json=payload,
    )
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["key"] == "tally_ledger_mappings"
    assert save_data["value"]["cash_ledger"] == "Custom Cash A/c"

    # 3. GET setting again returns saved payload
    res2 = client.get("/api/v1/settings/tally_ledger_mappings", headers=auth_headers)
    assert res2.status_code == 200
    assert res2.json()["value"]["cash_ledger"] == "Custom Cash A/c"


def test_daily_cash_sheet_api(client, auth_headers):
    # 1. GET non-existent cash sheet returns null
    res = client.get("/api/v1/income/cash-sheet?on_date=2026-07-30", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() is None

    # 2. POST to create cash sheet
    payload = {
        "sheet_date": "2026-07-30",
        "notes_500": 10,
        "notes_200": 5,
        "notes_100": 20,
        "notes_50": 0,
        "notes_20": 0,
        "notes_10": 0,
        "cash_sent_home": 15000.0,
        "prev_deposit": 5000.0,
        "ledger_interest": 0.0,
        "notes": "Daily closing notes",
    }
    save_res = client.post(
        "/api/v1/income/cash-sheet",
        headers=auth_headers,
        json=payload,
    )
    assert save_res.status_code == 200
    data = save_res.json()
    assert data["sheet_date"] == "2026-07-30"
    assert data["notes_500"] == 10
    assert float(data["cash_sent_home"]) == 15000.0


def test_database_backup_download_api(client, auth_headers):
    res = client.get("/api/v1/settings/backup/download", headers=auth_headers)
    assert res.status_code in (200, 404)


    # 3. GET cash sheet returns stored values
    res2 = client.get("/api/v1/income/cash-sheet?on_date=2026-07-30", headers=auth_headers)
    assert res2.status_code == 200
    sheet2 = res2.json()
    assert sheet2["notes_500"] == 10
    assert float(sheet2["cash_sent_home"]) == 15000.0
