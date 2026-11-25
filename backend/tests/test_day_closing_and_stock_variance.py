from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

P = "/api/v1"


def test_day_closing_wizard_and_lock_and_stock_variance(client, auth_headers, customer):
    """End-to-end test for Day Closing auto-computation, day locking,
    automatic stock variance computation after nozzle readings, and 3-day critical alert."""
    today = date.today()
    day_1 = today - timedelta(days=2)
    day_2 = today - timedelta(days=1)

    # 1. Create active fuel rate for PETROL (100.00)
    ps_resp = client.post(
        f"{P}/price-schedules",
        headers=auth_headers,
        json={
            "fuel_type": "PETROL",
            "rate": "100.00",
            "effective_from": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
        },
    )
    assert ps_resp.status_code in (200, 201), ps_resp.text

    # 2. Create Fuel Tank + Dispenser + Nozzle
    tank_resp = client.post(
        f"{P}/tanks",
        headers=auth_headers,
        json={
            "name": "Closing Test Petrol Tank",
            "fuel_type": "PETROL",
            "capacity_liters": 12000.0,
            "current_stock_liters": 5000.0,
        },
    )
    assert tank_resp.status_code == 201, tank_resp.text
    tank = tank_resp.json()

    disp_resp = client.post(
        f"{P}/nozzles/dispensers",
        headers=auth_headers,
        json={"name": "Dispenser DC-1", "status": "ACTIVE"},
    )
    assert disp_resp.status_code == 201, disp_resp.text
    dispenser = disp_resp.json()

    nozzle_resp = client.post(
        f"{P}/nozzles/dispensers/{dispenser['uuid']}/nozzles",
        headers=auth_headers,
        json={
            "name": "Nozzle DC-P1",
            "fuel_type": "PETROL",
            "tank_uuid": tank["uuid"],
            "last_reading": 1000.0,
        },
    )
    assert nozzle_resp.status_code == 201, nozzle_resp.text
    nozzle = nozzle_resp.json()

    # 3. Record nozzle readings for day_1, day_2, and today (100L each day)
    # Also simulate 3 consecutive CRITICAL physical dips (>1% loss on 5000L => >50L off)
    for idx, d in enumerate([day_1, day_2, today], start=1):
        opening = 1000.0 + (idx - 1) * 100.0
        closing = opening + 100.0
        r_resp = client.post(
            f"{P}/nozzles/readings/bulk",
            headers=auth_headers,
            json={
                "reading_date": d.isoformat(),
                "readings": [
                    {
                        "nozzle_uuid": nozzle["uuid"],
                        "opening_reading": opening,
                        "closing_reading": closing,
                        "testing_liters": 0.0,
                        "return_testing_to_storage": True,
                    }
                ],
            },
        )
        assert r_resp.status_code == 201, r_resp.text

        # Record physical dip that shows 80L unexplained loss each day
        daily_resp = client.get(
            f"{P}/stock-variances/daily",
            headers=auth_headers,
            params={"variance_date": d.isoformat()},
        )
        assert daily_resp.status_code == 200, daily_resp.text
        tank_row = next(item for item in daily_resp.json()["items"] if item["tank_uuid"] == tank["uuid"])
        dip_val = round(tank_row["book_stock"] - 80.0, 2)

        dip_resp = client.post(
            f"{P}/stock-variances/dips",
            headers=auth_headers,
            json={
                "variance_date": d.isoformat(),
                "dips": [{"tank_uuid": tank["uuid"], "physical_dip": dip_val}],
            },
        )
        assert dip_resp.status_code == 200, dip_resp.text
        updated_row = next(item for item in dip_resp.json()["items"] if item["tank_uuid"] == tank["uuid"])
        assert updated_row["status"] == "CRITICAL"
        assert updated_row["variance_liters"] == -80.0

    # Verify 3-day consecutive critical trend alert fires
    alerts_resp = client.get(
        f"{P}/stock-variances/alerts",
        headers=auth_headers,
        params={"as_of_date": today.isoformat()},
    )
    assert alerts_resp.status_code == 200, alerts_resp.text
    alerts = alerts_resp.json()
    assert any(a["tank_uuid"] == tank["uuid"] and a["consecutive_critical_days"] >= 3 for a in alerts)

    # 4. Create vouchers for today: 70L CASH (₹7000) + 20L UPI (₹2000) + 10L CREDIT (₹1000) = ₹10000
    for inv, mode, qty, cust in [
        ("DC-CASH-1", "CASH", "70.0", None),
        ("DC-UPI-1", "UPI", "20.0", None),
        ("DC-CRED-1", "CREDIT", "10.0", customer["uuid"]),
    ]:
        v_resp = client.post(
            f"{P}/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": inv,
                "invoice_date": today.isoformat(),
                "customer_uuid": cust,
                "fuel_type": "PETROL",
                "quantity_liters": qty,
                "rate_per_liter": "100.00",
                "total_amount": str(float(qty) * 100.0),
                "payment_mode": mode,
            },
        )
        assert v_resp.status_code == 201, v_resp.text

    # 5. Record a cash expense of ₹500 for today
    exp_resp = client.post(
        f"{P}/income",
        headers=auth_headers,
        json={
            "kind": "EXPENSE",
            "income_date": today.isoformat(),
            "description": "Generator Diesel & Tea",
            "amount": "500.00",
            "category": "Misc",
            "payment_mode": "CASH",
        },
    )
    assert exp_resp.status_code == 201, exp_resp.text

    # 6. Fetch Day Closing Draft
    draft_resp = client.get(
        f"{P}/day-closings/draft",
        headers=auth_headers,
        params={"date": today.isoformat()},
    )
    assert draft_resp.status_code == 200, draft_resp.text
    draft = draft_resp.json()
    assert Decimal(str(draft["gross_meter_sales"])) >= Decimal("10000.00")
    assert Decimal(str(draft["cash_sales"])) >= Decimal("7000.00")
    assert Decimal(str(draft["upi_sales"])) >= Decimal("2000.00")
    assert Decimal(str(draft["credit_sales"])) >= Decimal("1000.00")
    assert Decimal(str(draft["cash_expenses"])) >= Decimal("500.00")
    assert any(w["type"] == "STOCK_LOSS_TREND" for w in draft["warnings"])

    # 7. Save & Close Day: physical cash counted = expected - 100 (₹100 shortage)
    expected_cash = (
        Decimal(str(draft["opening_float"]))
        + Decimal(str(draft["cash_sales"]))
        - Decimal(str(draft["cash_expenses"]))
        - Decimal("1000.00")
    )
    counted = expected_cash - Decimal("100.00")

    close_resp = client.post(
        f"{P}/day-closings",
        headers=auth_headers,
        json={
            "closing_date": today.isoformat(),
            "physical_cash_counted": str(counted),
            "cash_to_next_day": "1000.00",
            "notes": "Night closing verified",
        },
    )
    assert close_resp.status_code == 201, close_resp.text
    closed = close_resp.json()
    assert closed["status"] == "LOCKED"
    assert Decimal(str(closed["variance"])) == Decimal("-100.00")

    # 8. Verify locked day blocks new vouchers on closed date (409)
    blocked_resp = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": "DC-BLOCKED-1",
            "invoice_date": today.isoformat(),
            "fuel_type": "PETROL",
            "quantity_liters": "10.0",
            "rate_per_liter": "100.00",
            "total_amount": "1000.00",
            "payment_mode": "CASH",
        },
    )
    assert blocked_resp.status_code == 409, blocked_resp.text

    # 9. Reopen day closing and verify voucher creation succeeds again
    reopen_resp = client.post(
        f"{P}/day-closings/{closed['uuid']}/reopen",
        headers=auth_headers,
    )
    assert reopen_resp.status_code == 200, reopen_resp.text
    assert reopen_resp.json()["status"] == "DRAFT"

    unblocked_resp = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": "DC-UNBLOCKED-1",
            "invoice_date": today.isoformat(),
            "fuel_type": "PETROL",
            "quantity_liters": "10.0",
            "rate_per_liter": "100.00",
            "total_amount": "1000.00",
            "payment_mode": "CASH",
        },
    )
    assert unblocked_resp.status_code == 201, unblocked_resp.text
