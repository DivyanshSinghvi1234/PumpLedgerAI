from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_day_closing_bank_sync_and_reopen_reversal(client, auth_headers):
    """Closing a day auto-credits UPI+Card + cash deposit to the selected bank account,
    and reopening reverses those bank transactions cleanly."""
    today = date.today() - timedelta(days=9)

    # 1. Create a bank account with ₹10,000 opening balance
    ba_resp = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "Main Pump Current",
            "bank_name": "HDFC Bank",
            "account_type": "CURRENT",
            "opening_balance": "10000.00",
        },
    )
    assert ba_resp.status_code == 201, ba_resp.text
    bank_uuid = ba_resp.json()["uuid"]

    # 2. Create a UPI voucher (₹1,500) and a CARD voucher (₹2,500) and CASH voucher (₹5,000)
    for mode, amt, idx in [("UPI", "1500.00", 1), ("CARD", "2500.00", 2), ("CASH", "5000.00", 3)]:
        v_resp = client.post(
            f"{P}/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": f"BS-{today.strftime('%Y%m%d')}-{idx}",
                "invoice_date": today.isoformat(),
                "payment_mode": mode,
                "fuel_type": "PETROL",
                "quantity_liters": "10.00",
                "rate_per_liter": str(Decimal(amt) / 10),
                "total_amount": amt,
            },
        )
        assert v_resp.status_code == 201, v_resp.text

    # 3. Close the day with cash_deposited_to_bank = ₹3,000
    close_resp = client.post(
        f"{P}/day-closings",
        headers=auth_headers,
        json={
            "closing_date": today.isoformat(),
            "physical_cash_counted": "5000.00",
            "cash_to_next_day": "2000.00",
            "settlement_bank_account_uuid": bank_uuid,
            "cash_deposited_to_bank": "3000.00",
        },
    )
    assert close_resp.status_code == 201, close_resp.text
    closing = close_resp.json()

    # Verify bank balance = 10,000 + (1,500 + 2,500 digital) + 3,000 cash deposit = 17,000
    list_resp = client.get(f"{P}/bank-accounts", headers=auth_headers)
    assert list_resp.status_code == 200
    acc = next(a for a in list_resp.json() if a["uuid"] == bank_uuid)
    assert Decimal(str(acc["current_balance"])) == Decimal("17000.00")

    # 4. Reopen the day -> bank balance must revert to 10,000.00
    reopen_resp = client.post(
        f"{P}/day-closings/{closing['uuid']}/reopen",
        headers=auth_headers,
    )
    assert reopen_resp.status_code == 200, reopen_resp.text

    list_resp_2 = client.get(f"{P}/bank-accounts", headers=auth_headers)
    acc_2 = next(a for a in list_resp_2.json() if a["uuid"] == bank_uuid)
    assert Decimal(str(acc_2["current_balance"])) == Decimal("10000.00")


def test_recurring_expenses_due_and_batch_post(client, auth_headers):
    """Recurring expenses surface as due, post into Income/Expense + Bank, and advance next_due_date."""
    today = date.today()
    future = today + timedelta(days=15)

    ba_resp = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "Bills Account",
            "bank_name": "SBI",
            "account_type": "CURRENT",
            "opening_balance": "50000.00",
        },
    )
    assert ba_resp.status_code == 201
    bank_uuid = ba_resp.json()["uuid"]

    # Create 1 due recurring expense and 1 future recurring expense
    r1 = client.post(
        f"{P}/recurring-expenses",
        headers=auth_headers,
        json={
            "title": "Electricity Bill",
            "category": "Utilities",
            "amount": "12000.00",
            "frequency": "MONTHLY",
            "payment_mode": "BANK",
            "bank_account_uuid": bank_uuid,
            "next_due_date": today.isoformat(),
        },
    )
    assert r1.status_code == 201, r1.text

    r2 = client.post(
        f"{P}/recurring-expenses",
        headers=auth_headers,
        json={
            "title": "Future Rent",
            "category": "Rent",
            "amount": "25000.00",
            "frequency": "MONTHLY",
            "payment_mode": "BANK",
            "bank_account_uuid": bank_uuid,
            "next_due_date": future.isoformat(),
        },
    )
    assert r2.status_code == 201, r2.text

    due_resp = client.get(f"{P}/recurring-expenses/due", headers=auth_headers)
    assert due_resp.status_code == 200
    due_titles = [d["title"] for d in due_resp.json()]
    assert "Electricity Bill" in due_titles
    assert "Future Rent" not in due_titles

    # Post all due
    post_resp = client.post(f"{P}/recurring-expenses/post-all-due", headers=auth_headers)
    assert post_resp.status_code == 200, post_resp.text
    body = post_resp.json()
    assert body["posted_count"] == 1
    assert Decimal(str(body["total_amount"])) == Decimal("12000.00")

    # Bank balance reduced to 38,000.00
    accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    acc = next(a for a in accs if a["uuid"] == bank_uuid)
    assert Decimal(str(acc["current_balance"])) == Decimal("38000.00")

    # No longer due today
    due_after = client.get(f"{P}/recurring-expenses/due", headers=auth_headers).json()
    assert all(d["title"] != "Electricity Bill" for d in due_after)


def test_batch_payroll_pay_all_and_idempotency(client, auth_headers):
    """Batch payroll pays all unpaid staff once, deducts from bank, and skips on re-run."""
    billing_month = date.today().strftime("%Y-%m")

    ba_resp = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "Payroll Bank",
            "bank_name": "ICICI",
            "account_type": "CURRENT",
            "opening_balance": "100000.00",
        },
    )
    assert ba_resp.status_code == 201
    bank_uuid = ba_resp.json()["uuid"]

    emp_uuids = []
    for name, salary in [("Raju Attendant", "15000.00"), ("Suresh Attendant", "18000.00")]:
        e_resp = client.post(
            f"{P}/employees",
            headers=auth_headers,
            json={
                "full_name": name,
                "role": "OPERATOR",
                "base_salary": salary,
                "commission_rate_per_liter": "0.00",
            },
        )
        assert e_resp.status_code == 201, e_resp.text
        emp_uuids.append(e_resp.json()["uuid"])

    # Run batch pay-all for these employees
    batch_resp = client.post(
        f"{P}/employees/payroll/pay-all",
        headers=auth_headers,
        json={
            "billing_month": billing_month,
            "payment_mode": "BANK",
            "bank_account_uuid": bank_uuid,
            "deduct_outstanding": True,
            "employee_uuids": emp_uuids,
        },
    )
    assert batch_resp.status_code == 200, batch_resp.text
    res = batch_resp.json()
    assert res["paid_count"] == 2
    assert Decimal(str(res["total_net_paid"])) == Decimal("33000.00")

    # Preview should now mark them already_paid_this_month=True
    prev = client.get(f"{P}/employees/payroll/preview?month={billing_month}", headers=auth_headers).json()
    target_rows = [r for r in prev["rows"] if r["employee_uuid"] in emp_uuids]
    assert len(target_rows) == 2
    assert all(r["already_paid_this_month"] is True for r in target_rows)

    # Re-running pay-all skips both
    batch_resp_2 = client.post(
        f"{P}/employees/payroll/pay-all",
        headers=auth_headers,
        json={
            "billing_month": billing_month,
            "payment_mode": "BANK",
            "bank_account_uuid": bank_uuid,
            "employee_uuids": emp_uuids,
        },
    )
    assert batch_resp_2.status_code == 200
    assert batch_resp_2.json()["paid_count"] == 0
    assert batch_resp_2.json()["skipped_count"] >= 2

    # Bank balance = 100,000 - 33,000 = 67,000
    accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    acc = next(a for a in accs if a["uuid"] == bank_uuid)
    assert Decimal(str(acc["current_balance"])) == Decimal("67000.00")
