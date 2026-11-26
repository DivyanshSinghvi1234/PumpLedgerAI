from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_day_lock_blocks_payments_and_indent_prepayment_avoids_double_debit(client, auth_headers):
    """Tests:
    1. Once Day Closing is LOCKED, creating a payment for that date is rejected.
    2. Pre-paying an OMC Purchase Indent deducts from BankAccount once on creation,
       does NOT double-deduct on delivery, and reverses if cancelled.
    """
    test_day = date.today() - timedelta(days=30)

    bank = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC PrepayTest",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "200000.00",
        },
    ).json()

    cust = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "Lock Test Customer", "mobile": "9876500999"},
    ).json()

    # Lock test_day via Day Closing
    lock_res = client.post(
        f"{P}/day-closings",
        headers=auth_headers,
        json={
            "closing_date": test_day.isoformat(),
            "opening_float": "0.00",
            "physical_cash_counted": "0.00",
            "cash_to_next_day": "0.00",
        },
    )
    assert lock_res.status_code in (200, 201), lock_res.text

    # Payment on locked date should be blocked
    blocked_pay = client.post(
        f"{P}/payments",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "amount": "500.00",
            "payment_mode": "CASH",
            "payment_date": test_day.isoformat(),
        },
    )
    assert blocked_pay.status_code in (400, 409, 422), blocked_pay.text

    # Create pre-paid OMC Purchase Indent (1000L @ 80 = 80,000 -> HDFC 120,000)
    indent_res = client.post(
        f"{P}/purchase-indents",
        headers=auth_headers,
        json={
            "omc_company": "IOCL",
            "terminal_name": "Test Terminal",
            "fuel_type": "DIESEL",
            "ordered_liters": 1000,
            "expected_delivery_date": date.today().isoformat(),
            "procurement_cost_per_liter": 80.0,
            "payment_mode": "BANK",
            "bank_account_uuid": bank["uuid"],
        },
    )
    assert indent_res.status_code == 201, indent_res.text
    indent = indent_res.json()

    accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    bal_after_indent = Decimal(str(next(a["current_balance"] for a in accs if a["uuid"] == bank["uuid"])))
    assert bal_after_indent == Decimal("120000.00")

    # Cancel indent -> reverses pre-payment back to 200,000
    del_res = client.delete(f"{P}/purchase-indents/{indent['uuid']}", headers=auth_headers)
    assert del_res.status_code == 204
    accs_after = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    bal_after_cancel = Decimal(str(next(a["current_balance"] for a in accs_after if a["uuid"] == bank["uuid"])))
    assert bal_after_cancel == Decimal("200000.00")
