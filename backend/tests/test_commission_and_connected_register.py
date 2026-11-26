from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

P = "/api/v1"


def test_commission_profit_and_connected_register_closing(client, auth_headers):
    """Verify:
    1. Setting fuel_commission_rates calculates commission profit from nozzle readings
       even with no tanker procurement rate or cash vouchers.
    2. Closing the day with auto_balance_cash=True updates Cash-in-Hand and Bank balance
       automatically, and reopening reverses both cleanly.
    """
    target = date.today() - timedelta(days=6)

    # 1. Configure Petrol price ₹100/L and commission ₹3.50/L
    assert (
        client.post(
            f"{P}/price-schedules",
            headers=auth_headers,
            json={
                "fuel_type": "PETROL",
                "rate": "100.00",
                "effective_from": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
            },
        ).status_code
        in (200, 201)
    )
    comm_resp = client.post(
        f"{P}/settings/fuel_commission_rates",
        headers=auth_headers,
        json={"value": {"PETROL": 3.5, "DIESEL": 2.2}},
    )
    assert comm_resp.status_code == 200, comm_resp.text

    # 2. Setup Bank, Tank, Dispenser, Nozzle
    bank = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "Register Bank",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "5000.00",
        },
    ).json()
    tank = client.post(
        f"{P}/tanks",
        headers=auth_headers,
        json={
            "name": "Conn Petrol Tank",
            "fuel_type": "PETROL",
            "capacity_liters": 10000.0,
            "current_stock_liters": 4000.0,
        },
    ).json()
    disp = client.post(
        f"{P}/nozzles/dispensers",
        headers=auth_headers,
        json={"name": "Conn Pump 1", "status": "ACTIVE"},
    ).json()
    nozzle = client.post(
        f"{P}/nozzles/dispensers/{disp['uuid']}/nozzles",
        headers=auth_headers,
        json={
            "name": "Conn P1",
            "fuel_type": "PETROL",
            "tank_uuid": tank["uuid"],
            "last_reading": 100.0,
        },
    ).json()

    # 3. Record 200L sold via meter reading (₹20,000 gross) and ₹200 cash expense
    r_resp = client.post(
        f"{P}/nozzles/readings/bulk",
        headers=auth_headers,
        json={
            "reading_date": target.isoformat(),
            "readings": [
                {
                    "nozzle_uuid": nozzle["uuid"],
                    "opening_reading": 100.0,
                    "closing_reading": 300.0,
                    "testing_liters": 0.0,
                    "return_testing_to_storage": True,
                }
            ],
        },
    )
    assert r_resp.status_code == 201, r_resp.text

    # Tank stock should automatically drop from 4000 to 3800
    tanks = client.get(f"{P}/tanks", headers=auth_headers).json()
    updated_tank = next(t for t in tanks if t["uuid"] == tank["uuid"])
    assert updated_tank["current_stock_liters"] == 3800.0

    # Add ₹200 cash expense
    assert (
        client.post(
            f"{P}/income",
            headers=auth_headers,
            json={
                "kind": "EXPENSE",
                "income_date": target.isoformat(),
                "description": "Tea & Cleaning",
                "amount": "200.00",
                "category": "Misc",
                "payment_mode": "CASH",
            },
        ).status_code
        == 201
    )

    # 4. Snapshot & PnL should reflect 200L, ₹20,000 revenue, ₹700 commission profit, ₹500 net profit
    snap = client.get(
        f"{P}/pipeline/snapshot?target_date={target.isoformat()}",
        headers=auth_headers,
    ).json()
    assert snap["profit"]["fuel_liters"] == 200.0
    assert snap["profit"]["commission_profit"] == 700.0
    assert snap["profit"]["net_profit"] == 500.0
    assert snap["cash_proof"]["expected_drawer_cash"] == 19800.0

    # 5. Close day with auto_balance_cash=True and ₹5,000 deposited to bank
    before_funds = client.get(f"{P}/bank-accounts/summary", headers=auth_headers).json()
    before_cash = Decimal(str(before_funds["total_cash_available"]))

    close_resp = client.post(
        f"{P}/day-closings",
        headers=auth_headers,
        json={
            "closing_date": target.isoformat(),
            "physical_cash_counted": "19800.00",
            "cash_to_next_day": "0.00",
            "settlement_bank_account_uuid": bank["uuid"],
            "cash_deposited_to_bank": "5000.00",
            "auto_balance_cash": True,
        },
    )
    assert close_resp.status_code == 201, close_resp.text
    closing = close_resp.json()
    assert Decimal(str(closing["cash_sales"])) == Decimal("20000.00")

    # Cash-in-hand increases by 20000 - 5000 = 15000 (or 14800 net of the ₹200 expense if starting from 0)
    # Bank balance = 5000 + 5000 = 10000
    accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    bank_after = next(a for a in accs if a["uuid"] == bank["uuid"])
    assert Decimal(str(bank_after["current_balance"])) == Decimal("10000.00")
    funds = client.get(f"{P}/bank-accounts/summary", headers=auth_headers).json()
    assert Decimal(str(funds["total_cash_available"])) >= Decimal("14800.00")

    # 6. Reopen reverses bank deposit and auto-balanced cash summary voucher cleanly
    reopen = client.post(
        f"{P}/day-closings/{closing['uuid']}/reopen",
        headers=auth_headers,
    )
    assert reopen.status_code == 200, reopen.text
    accs2 = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    bank_reopened = next(a for a in accs2 if a["uuid"] == bank["uuid"])
    assert Decimal(str(bank_reopened["current_balance"])) == Decimal("5000.00")
    funds2 = client.get(f"{P}/bank-accounts/summary", headers=auth_headers).json()
    assert Decimal(str(funds2["total_cash_available"])) == before_cash
