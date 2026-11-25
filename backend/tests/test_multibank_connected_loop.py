from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_multibank_payment_voucher_delivery_income_and_day_closing(client, auth_headers):
    """End-to-end test verifying HDFC & SBI multi-bank routing across:
    - Customer Payment + Delete reversal
    - Direct BANK Voucher + Delete reversal
    - Direct TankerDelivery (bank debit + weighted avg cost)
    - Income Delete reversal
    - Day Closing with separate UPI (SBI) and Card (HDFC) bank accounts + Reopen reversal
    """
    today = date.today() - timedelta(days=10)

    # 1. Create two bank accounts: HDFC & SBI
    hdfc = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC Current",
            "bank_name": "HDFC Bank",
            "account_type": "CURRENT",
            "opening_balance": "100000.00",
        },
    ).json()
    sbi = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "SBI Current",
            "bank_name": "State Bank of India",
            "account_type": "CURRENT",
            "opening_balance": "50000.00",
        },
    ).json()
    hdfc_uuid, sbi_uuid = hdfc["uuid"], sbi["uuid"]

    def _bal(bank_uuid: str) -> Decimal:
        accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
        return Decimal(str(next(a["current_balance"] for a in accs if a["uuid"] == bank_uuid)))

    # 2. Customer + Payment to HDFC (+10,000 -> 110,000), then Delete -> back to 100,000
    cust = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "MultiBank Fleet", "opening_balance": "20000.00"},
    ).json()

    pay = client.post(
        f"{P}/payments",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "amount": "10000.00",
            "payment_mode": "BANK",
            "bank_account_uuid": hdfc_uuid,
            "payment_date": today.isoformat(),
        },
    )
    assert pay.status_code == 201, pay.text
    assert _bal(hdfc_uuid) == Decimal("110000.00")
    assert _bal(sbi_uuid) == Decimal("50000.00")

    del_pay = client.delete(f"{P}/payments/{pay.json()['uuid']}", headers=auth_headers)
    assert del_pay.status_code == 204
    assert _bal(hdfc_uuid) == Decimal("100000.00")

    # 3. Direct BANK Voucher to SBI (+5,000 -> 55,000), then Delete -> back to 50,000
    vch = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"MB-VCH-{today.strftime('%Y%m%d')}",
            "invoice_date": today.isoformat(),
            "payment_mode": "BANK",
            "bank_account_uuid": sbi_uuid,
            "fuel_type": "DIESEL",
            "quantity_liters": "50.00",
            "rate_per_liter": "100.00",
            "total_amount": "5000.00",
        },
    )
    assert vch.status_code == 201, vch.text
    assert _bal(sbi_uuid) == Decimal("55000.00")

    del_vch = client.delete(f"{P}/vouchers/{vch.json()['uuid']}", headers=auth_headers)
    assert del_vch.status_code == 204
    assert _bal(sbi_uuid) == Decimal("50000.00")

    # 4. Direct TankerDelivery paid via HDFC (-40,000 -> 60,000)
    tank = client.post(
        f"{P}/tanks",
        headers=auth_headers,
        json={
            "name": "MultiBank Tank",
            "fuel_type": "PETROL",
            "capacity_liters": 20000.0,
            "current_stock_liters": 0.0,
        },
    ).json()
    deliv = client.post(
        f"{P}/tanks/deliveries",
        headers=auth_headers,
        json={
            "tank_uuid": tank["uuid"],
            "delivery_date": today.isoformat(),
            "invoice_number": "MB-DEL-1",
            "quantity_liters": 500.0,
            "procurement_rate": 80.0,
            "payment_mode": "BANK",
            "bank_account_uuid": hdfc_uuid,
        },
    )
    assert deliv.status_code == 201, deliv.text
    assert _bal(hdfc_uuid) == Decimal("60000.00")

    # 5. Income Expense via SBI (-2,000 -> 48,000), then Delete -> back to 50,000
    inc = client.post(
        f"{P}/income",
        headers=auth_headers,
        json={
            "kind": "EXPENSE",
            "income_date": today.isoformat(),
            "description": "Generator Maintenance",
            "amount": "2000.00",
            "category": "Maintenance",
            "payment_mode": "BANK",
            "bank_account_uuid": sbi_uuid,
        },
    )
    assert inc.status_code == 201, inc.text
    assert _bal(sbi_uuid) == Decimal("48000.00")

    del_inc = client.delete(f"{P}/income/{inc.json()['uuid']}", headers=auth_headers)
    assert del_inc.status_code == 204
    assert _bal(sbi_uuid) == Decimal("50000.00")

    # 6. Day Closing splitting UPI -> SBI (+1,200) and Card -> HDFC (+2,800), then Reopen reversal
    for mode, amt, idx in [("UPI", "1200.00", 1), ("CARD", "2800.00", 2)]:
        r = client.post(
            f"{P}/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": f"MB-DC-{today.strftime('%Y%m%d')}-{idx}",
                "invoice_date": today.isoformat(),
                "payment_mode": mode,
                "fuel_type": "PETROL",
                "quantity_liters": "10.00",
                "rate_per_liter": str(Decimal(amt) / 10),
                "total_amount": amt,
            },
        )
        assert r.status_code == 201

    dc = client.post(
        f"{P}/day-closings",
        headers=auth_headers,
        json={
            "closing_date": today.isoformat(),
            "physical_cash_counted": "0.00",
            "cash_to_next_day": "0.00",
            "upi_bank_account_uuid": sbi_uuid,
            "card_bank_account_uuid": hdfc_uuid,
        },
    )
    assert dc.status_code == 201, dc.text
    assert _bal(sbi_uuid) == Decimal("51200.00")
    assert _bal(hdfc_uuid) == Decimal("62800.00")

    reopen = client.post(
        f"{P}/day-closings/{dc.json()['uuid']}/reopen",
        headers=auth_headers,
    )
    assert reopen.status_code == 200
    assert _bal(sbi_uuid) == Decimal("50000.00")
    assert _bal(hdfc_uuid) == Decimal("60000.00")
