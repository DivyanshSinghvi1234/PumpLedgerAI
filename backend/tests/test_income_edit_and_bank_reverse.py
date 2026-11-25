from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_income_edit_bank_resync_and_bank_txn_reverse(client, auth_headers):
    """Tests:
    1. Editing an Income/Expense entry reverses old bank txn and posts to the new bank account
    2. DELETE /bank-accounts/transactions/{uuid} reverses a bank transaction cleanly
    """
    test_day = date.today() - timedelta(days=18)

    hdfc = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC EditTest",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "10000.00",
        },
    ).json()
    sbi = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "SBI EditTest",
            "bank_name": "SBI",
            "account_type": "CURRENT",
            "opening_balance": "10000.00",
        },
    ).json()

    def _bal(bank_uuid: str) -> Decimal:
        accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
        return Decimal(str(next(a["current_balance"] for a in accs if a["uuid"] == bank_uuid)))

    # 1. Create Expense via HDFC (-1,000 => HDFC 9,000)
    inc = client.post(
        f"{P}/income",
        headers=auth_headers,
        json={
            "kind": "EXPENSE",
            "income_date": test_day.isoformat(),
            "description": "Electricity Bill",
            "amount": "1000.00",
            "category": "Utilities",
            "payment_mode": "BANK",
            "bank_account_uuid": hdfc["uuid"],
        },
    ).json()
    assert _bal(hdfc["uuid"]) == Decimal("9000.00")

    # 2. Edit Expense to SBI with amount 2,500 => HDFC back to 10,000, SBI = 7,500
    upd = client.put(
        f"{P}/income/{inc['uuid']}",
        headers=auth_headers,
        json={
            "kind": "EXPENSE",
            "income_date": test_day.isoformat(),
            "description": "Electricity Bill Revised",
            "amount": "2500.00",
            "category": "Utilities",
            "payment_mode": "BANK",
            "bank_account_uuid": sbi["uuid"],
        },
    )
    assert upd.status_code == 200, upd.text
    assert _bal(hdfc["uuid"]) == Decimal("10000.00")
    assert _bal(sbi["uuid"]) == Decimal("7500.00")

    # 3. Deposit 1,500 to HDFC (11,500), then reverse that transaction -> back to 10,000
    dep = client.post(
        f"{P}/bank-accounts/deposit-cash",
        headers=auth_headers,
        json={
            "bank_account_uuid": hdfc["uuid"],
            "amount": "1500.00",
            "deposit_date": test_day.isoformat(),
        },
    )
    assert dep.status_code == 200, dep.text
    txn_uuid = dep.json()["transaction_uuid"]
    assert _bal(hdfc["uuid"]) == Decimal("11500.00")

    rev = client.delete(f"{P}/bank-accounts/transactions/{txn_uuid}", headers=auth_headers)
    assert rev.status_code == 204
    assert _bal(hdfc["uuid"]) == Decimal("10000.00")
