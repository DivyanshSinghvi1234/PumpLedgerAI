from datetime import date, datetime, timezone
from decimal import Decimal

P = "/api/v1"


def test_smart_voucher_autofill_and_warnings(client, auth_headers):
    """Smart voucher suggestion auto-fills customer, fuel, rate, payment mode,
    and flags unusual quantity, fuzzy customer match, and possible duplicates."""
    cust_resp = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "Sharma Transport SmartTest", "opening_balance": "0.00"},
    )
    assert cust_resp.status_code == 201, cust_resp.text
    cust = cust_resp.json()

    veh_resp = client.post(
        f"{P}/vehicles",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "vehicle_number": "HR26BR9080",
            "vehicle_type": "Truck",
        },
    )
    assert veh_resp.status_code == 201, veh_resp.text

    # Seed an active Diesel price schedule for today
    ps_resp = client.post(
        f"{P}/price-schedules",
        headers=auth_headers,
        json={
            "fuel_type": "DIESEL",
            "rate": "89.50",
            "effective_from": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert ps_resp.status_code in (200, 201), ps_resp.text

    # Create 3 historical vouchers for this vehicle (~45L DIESEL on CREDIT)
    for i, qty in enumerate(["42.0", "45.0", "48.0"], start=1):
        resp = client.post(
            f"{P}/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": f"SMART-HIST-{i}",
                "invoice_date": date.today().isoformat(),
                "vehicle_number": "HR26BR9080",
                "customer_uuid": cust["uuid"],
                "fuel_type": "DIESEL",
                "quantity_liters": qty,
                "rate_per_liter": "89.50",
                "total_amount": str(round(float(qty) * 89.50, 2)),
                "payment_mode": "CREDIT",
            },
        )
        assert resp.status_code == 201, resp.text

    # 1. Suggest with inconsistent plate formatting + outlier quantity + matching total
    suggest_resp = client.post(
        f"{P}/vouchers/suggest",
        headers=auth_headers,
        json={
            "vehicle_number": "hr-26 br 9080",
            "quantity_liters": "350.0",
            "total_amount": str(round(45.0 * 89.50, 2)),
            "invoice_date": date.today().isoformat(),
        },
    )
    assert suggest_resp.status_code == 200, suggest_resp.text
    data = suggest_resp.json()

    assert data["normalized_vehicle_number"] == "HR26BR9080"
    assert data["customer_uuid"] == cust["uuid"]
    assert data["customer_name"] == cust["name"]
    assert data["customer_confidence"] >= 0.9
    assert data["fuel_type"] == "DIESEL"
    assert data["fuel_type_confidence"] == 1.0
    assert Decimal(str(data["rate_per_liter"])) == Decimal("89.50")
    assert data["payment_mode"] == "CREDIT"
    assert data["payment_mode_confidence"] == 1.0
    assert data["vehicle_sample_count"] == 3

    warning_types = {w["type"] for w in data["warnings"]}
    assert "UNUSUAL_QUANTITY" in warning_types
    assert "POSSIBLE_DUPLICATE" in warning_types

    # 2. Suggest with fuzzy customer name ("Sharma Transprt" -> "Sharma Transport SmartTest")
    fuzzy_resp = client.post(
        f"{P}/vouchers/suggest",
        headers=auth_headers,
        json={"customer_name": "Sharma Transprt"},
    )
    assert fuzzy_resp.status_code == 200, fuzzy_resp.text
    fuzzy_data = fuzzy_resp.json()
    fuzzy_warnings = [w for w in fuzzy_data["warnings"] if w["type"] == "FUZZY_CUSTOMER_MATCH"]
    assert len(fuzzy_warnings) == 1
    assert any(c["customer_uuid"] == cust["uuid"] for c in fuzzy_warnings[0]["candidates"])
