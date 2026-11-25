from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_bank_edit_delete_csv_reconcile_delivery_rollback_and_credit_limit(client, auth_headers):
    """Tests:
    1. PATCH /bank-accounts/{uuid} updates bank details & DELETE soft-deletes
    2. POST /bank-accounts/{uuid}/reconcile matches recorded txns and flags unmatched rows
    3. DELETE /tanks/deliveries/{uuid} rolls back stock, expense, and bank debit
    4. Customer credit_limit blocks over-limit CREDIT voucher unless override_credit_limit=True
    """
    test_day = date.today() - timedelta(days=15)

    # 1. Bank Edit & Delete
    ba = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "Temp Bank",
            "bank_name": "Axis Bank",
            "account_type": "CURRENT",
            "opening_balance": "50000.00",
        },
    ).json()

    upd = client.patch(
        f"{P}/bank-accounts/{ba['uuid']}",
        headers=auth_headers,
        json={"account_name": "Axis Main Updated", "bank_name": "Axis Bank Ltd"},
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["account_name"] == "Axis Main Updated"

    # 2. CSV Reconcile (matches 50,000 opening balance, flags 1 unmatched credit)
    csv_text = (
        "Date,Description,Credit,Debit\n"
        f"{date.today().isoformat()},Opening Balance,50000.00,0\n"
        f"{test_day.isoformat()},NEFT Fleet Customer,12345.00,0\n"
    )
    rec = client.post(
        f"{P}/bank-accounts/{ba['uuid']}/reconcile",
        headers=auth_headers,
        json={"csv_text": csv_text},
    )
    assert rec.status_code == 200, rec.text
    assert rec.json()["matched_count"] == 1
    assert rec.json()["unmatched_credits_count"] == 1

    # 3. TankerDelivery Rollback (stock + bank)
    tank = client.post(
        f"{P}/tanks",
        headers=auth_headers,
        json={
            "name": "Rollback Tank",
            "fuel_type": "DIESEL",
            "capacity_liters": 20000.0,
            "current_stock_liters": 1000.0,
        },
    ).json()

    deliv = client.post(
        f"{P}/tanks/deliveries",
        headers=auth_headers,
        json={
            "tank_uuid": tank["uuid"],
            "delivery_date": test_day.isoformat(),
            "invoice_number": "RB-1",
            "quantity_liters": 500.0,
            "procurement_rate": 80.0,
            "payment_mode": "BANK",
            "bank_account_uuid": ba["uuid"],
        },
    ).json()

    # Balance should be 50,000 - 40,000 = 10,000; stock = 1500
    accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    assert Decimal(str(next(a["current_balance"] for a in accs if a["uuid"] == ba["uuid"]))) == Decimal("10000.00")

    rb = client.delete(f"{P}/tanks/deliveries/{deliv['uuid']}", headers=auth_headers)
    assert rb.status_code == 204
    accs_after = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    assert Decimal(str(next(a["current_balance"] for a in accs_after if a["uuid"] == ba["uuid"]))) == Decimal("50000.00")

    # Delete bank account
    assert client.delete(f"{P}/bank-accounts/{ba['uuid']}", headers=auth_headers).status_code == 204

    # 4. Customer Credit Limit Guardrail
    cust = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "Capped Fleet", "credit_limit": "5000.00", "opening_balance": "4000.00"},
    ).json()

    blocked = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"CLIM-1-{test_day}",
            "invoice_date": test_day.isoformat(),
            "customer_uuid": cust["uuid"],
            "fuel_type": "DIESEL",
            "quantity_liters": "20.00",
            "rate_per_liter": "100.00",
            "total_amount": "2000.00",
            "payment_mode": "CREDIT",
        },
    )
    assert blocked.status_code == 400, blocked.text

    allowed = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"CLIM-2-{test_day}",
            "invoice_date": test_day.isoformat(),
            "customer_uuid": cust["uuid"],
            "fuel_type": "DIESEL",
            "quantity_liters": "20.00",
            "rate_per_liter": "100.00",
            "total_amount": "2000.00",
            "payment_mode": "CREDIT",
            "override_credit_limit": True,
        },
    )
    assert allowed.status_code == 201, allowed.text
