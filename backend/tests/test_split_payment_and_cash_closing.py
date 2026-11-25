from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_split_payment_and_cash_in_day_closing(client, auth_headers):
    """Tests:
    1. Split payment (Cash + Bank/UPI) credits BankAccount only by bank_amount
       and adds only cash_amount to Total Cash Available.
    2. Day Closing expected_cash includes CASH and SPLIT cash_amount payments.
    """
    test_day = date.today() - timedelta(days=25)

    # 1. Create Bank Account (opening 10,000)
    bank_res = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC SplitTest",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "10000.00",
        },
    )
    assert bank_res.status_code in (200, 201), bank_res.text
    bank = bank_res.json()

    # 2. Create Customer & Credit Voucher (10,000)
    cust_res = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "Split Fleet Customer", "mobile": "9876500111"},
    )
    assert cust_res.status_code in (200, 201), cust_res.text
    cust = cust_res.json()

    v_res = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "invoice_number": "INV-SPLIT-001",
            "invoice_date": test_day.isoformat(),
            "fuel_type": "DIESEL",
            "quantity_liters": "100.00",
            "rate_per_liter": "100.00",
            "total_amount": "10000.00",
            "payment_mode": "CREDIT",
        },
    )
    assert v_res.status_code in (200, 201), v_res.text

    # 3. Record SPLIT payment (3,000 Cash + 7,000 Bank) via FIFO allocate
    pay_res = client.post(
        f"{P}/payments/allocate-fifo",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "amount": "10000.00",
            "payment_mode": "SPLIT",
            "cash_amount": "3000.00",
            "bank_amount": "7000.00",
            "bank_account_uuid": bank["uuid"],
            "payment_date": test_day.isoformat(),
            "remarks": "Split test payment",
        },
    )
    assert pay_res.status_code in (200, 201), pay_res.text
    pay = pay_res.json()
    assert Decimal(str(pay["cash_amount"])) == Decimal("3000.00")
    assert Decimal(str(pay["bank_amount"])) == Decimal("7000.00")

    # Verify bank balance increased by 7,000 only (10,000 -> 17,000)
    summary = client.get(f"{P}/bank-accounts/summary", headers=auth_headers).json()
    hdfc_acc = next(a for a in summary["accounts"] if a["uuid"] == bank["uuid"])
    assert Decimal(str(hdfc_acc["current_balance"])) == Decimal("17000.00")
    assert Decimal(str(summary["total_cash_available"])) >= Decimal("3000.00")

    # 4. Verify Day Closing expected_cash includes the 3,000 cash part
    close_res = client.post(
        f"{P}/day-closing",
        headers=auth_headers,
        json={
            "closing_date": test_day.isoformat(),
            "opening_float": "0.00",
            "physical_cash_counted": "3000.00",
            "cash_to_next_day": "0.00",
        },
    )
    assert close_res.status_code in (200, 201), close_res.text
    closing = close_res.json()
    assert Decimal(str(closing["expected_cash"])) == Decimal("3000.00")
    assert Decimal(str(closing["variance"])) == Decimal("0.00")
