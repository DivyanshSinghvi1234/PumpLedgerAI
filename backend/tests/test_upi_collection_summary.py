from datetime import date
from decimal import Decimal

P = "/api/v1"


def test_upi_collection_summary_groups_by_upi_handle(client, auth_headers):
    """Tests:
    GET /api/v1/bank-accounts/upi-summary aggregates UPI and SPLIT-UPI
    receipts by named UPI handle (PhonePe vs Paytm) and linked bank account.
    """
    test_day = date.today()

    hdfc = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC UPI Summary",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "0.00",
        },
    ).json()

    sbi = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "SBI UPI Summary",
            "bank_name": "SBI",
            "account_type": "CURRENT",
            "opening_balance": "0.00",
        },
    ).json()

    client.post(
        f"{P}/bank-accounts/upi",
        headers=auth_headers,
        json={
            "name": "Nozzle PhonePe",
            "provider": "PHONEPE",
            "bank_account_uuid": hdfc["uuid"],
        },
    )
    client.post(
        f"{P}/bank-accounts/upi",
        headers=auth_headers,
        json={
            "name": "Office Paytm",
            "provider": "PAYTM",
            "bank_account_uuid": sbi["uuid"],
        },
    )

    cust = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "UPI Summary Customer", "mobile": "9876500777"},
    ).json()

    # Payment 1: 1,500 UPI via PhonePe
    p1 = client.post(
        f"{P}/payments",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "amount": "1500.00",
            "payment_mode": "UPI",
            "bank_account_uuid": hdfc["uuid"],
            "payment_date": test_day.isoformat(),
            "reference_number": "PHONEPE:Nozzle PhonePe",
        },
    )
    assert p1.status_code == 201, p1.text

    # Payment 2: Split 1,000 Cash + 2,500 UPI via Paytm
    p2 = client.post(
        f"{P}/payments",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "amount": "3500.00",
            "payment_mode": "SPLIT",
            "cash_amount": "1000.00",
            "bank_amount": "2500.00",
            "bank_account_uuid": sbi["uuid"],
            "payment_date": test_day.isoformat(),
            "reference_number": "PAYTM:Office Paytm",
        },
    )
    assert p2.status_code == 201, p2.text

    res = client.get(
        f"{P}/bank-accounts/upi-summary",
        params={"on_date": test_day.isoformat()},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert Decimal(str(data["total_upi"])) >= Decimal("4000.00")

    by_name = {item["name"]: item for item in data["items"]}
    assert Decimal(str(by_name["Nozzle PhonePe"]["amount"])) >= Decimal("1500.00")
    assert Decimal(str(by_name["Office Paytm"]["amount"])) >= Decimal("2500.00")
