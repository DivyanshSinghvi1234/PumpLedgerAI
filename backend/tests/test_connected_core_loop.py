from datetime import date, timedelta
from decimal import Decimal

P = "/api/v1"


def test_auto_fifo_payment_voucher_edit_cascade_and_bank_transfers(client, auth_headers):
    """Tests:
    1. Standard POST /payments auto-settles oldest CREDIT vouchers FIFO & credits HDFC
    2. Deleting that payment reverts both voucher status and HDFC balance
    3. Editing a BANK voucher switches bank credit from HDFC to SBI cleanly
    4. Bank-to-Bank transfer (SBI -> HDFC) and Bank-to-Cash withdrawal update liquid funds accurately
    """
    test_day = date.today() - timedelta(days=12)

    hdfc = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC Core",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "10000.00",
        },
    ).json()
    sbi = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "SBI Core",
            "bank_name": "SBI",
            "account_type": "CURRENT",
            "opening_balance": "20000.00",
        },
    ).json()
    hdfc_uuid, sbi_uuid = hdfc["uuid"], sbi["uuid"]

    def _bal(bank_uuid: str) -> Decimal:
        accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
        return Decimal(str(next(a["current_balance"] for a in accs if a["uuid"] == bank_uuid)))

    # 1. Create customer + 2 credit vouchers (1000 + 1500)
    cust = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "Connected Loop Fleet", "opening_balance": "0.00"},
    ).json()

    v1 = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"CL-1-{test_day}",
            "invoice_date": test_day.isoformat(),
            "customer_uuid": cust["uuid"],
            "fuel_type": "DIESEL",
            "quantity_liters": "10.00",
            "rate_per_liter": "100.00",
            "total_amount": "1000.00",
            "payment_mode": "CREDIT",
        },
    ).json()
    v2 = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"CL-2-{test_day}",
            "invoice_date": test_day.isoformat(),
            "customer_uuid": cust["uuid"],
            "fuel_type": "DIESEL",
            "quantity_liters": "15.00",
            "rate_per_liter": "100.00",
            "total_amount": "1500.00",
            "payment_mode": "CREDIT",
        },
    ).json()

    # Standard POST /payments of 1200 to HDFC -> v1 PAID, v2 PARTIAL (200), HDFC = 11200
    pay = client.post(
        f"{P}/payments",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "amount": "1200.00",
            "payment_mode": "BANK",
            "bank_account_uuid": hdfc_uuid,
            "payment_date": test_day.isoformat(),
        },
    )
    assert pay.status_code == 201, pay.text
    assert _bal(hdfc_uuid) == Decimal("11200.00")

    v1_after = client.get(f"{P}/vouchers/{v1['uuid']}", headers=auth_headers).json()
    v2_after = client.get(f"{P}/vouchers/{v2['uuid']}", headers=auth_headers).json()
    assert v1_after["payment_status"] == "PAID"
    assert v2_after["payment_status"] == "PARTIAL"

    # Delete payment -> v1 UNPAID, v2 UNPAID, HDFC back to 10000
    assert client.delete(f"{P}/payments/{pay.json()['uuid']}", headers=auth_headers).status_code == 204
    assert _bal(hdfc_uuid) == Decimal("10000.00")
    assert client.get(f"{P}/vouchers/{v1['uuid']}", headers=auth_headers).json()["payment_status"] == "UNPAID"

    # 2. Voucher Edit Cascade: create BANK voucher to HDFC (3000 -> 13000), edit to SBI (4000 -> HDFC 10000, SBI 24000)
    v_bank = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "invoice_number": f"CL-BANK-{test_day}",
            "invoice_date": test_day.isoformat(),
            "payment_mode": "BANK",
            "bank_account_uuid": hdfc_uuid,
            "fuel_type": "PETROL",
            "quantity_liters": "30.00",
            "rate_per_liter": "100.00",
            "total_amount": "3000.00",
        },
    ).json()
    assert _bal(hdfc_uuid) == Decimal("13000.00")

    upd = client.put(
        f"{P}/vouchers/{v_bank['uuid']}",
        headers=auth_headers,
        json={
            "quantity_liters": "40.00",
            "total_amount": "4000.00",
            "bank_account_uuid": sbi_uuid,
        },
    )
    assert upd.status_code == 200, upd.text
    assert _bal(hdfc_uuid) == Decimal("10000.00")
    assert _bal(sbi_uuid) == Decimal("24000.00")

    # 3. Bank-to-Bank Transfer (SBI -> HDFC 5000 => SBI 19000, HDFC 15000)
    tr = client.post(
        f"{P}/bank-accounts/transfer",
        headers=auth_headers,
        json={
            "from_bank_account_uuid": sbi_uuid,
            "to_bank_account_uuid": hdfc_uuid,
            "amount": "5000.00",
            "transfer_date": test_day.isoformat(),
        },
    )
    assert tr.status_code == 200, tr.text
    assert _bal(sbi_uuid) == Decimal("19000.00")
    assert _bal(hdfc_uuid) == Decimal("15000.00")

    # 4. Withdraw Bank to Cash (HDFC -> Cash 2000 => HDFC 13000, cash_available increases by 2000)
    before_cash = Decimal(str(client.get(f"{P}/bank-accounts/summary", headers=auth_headers).json()["total_cash_available"]))
    wd = client.post(
        f"{P}/bank-accounts/withdraw-cash",
        headers=auth_headers,
        json={
            "bank_account_uuid": hdfc_uuid,
            "amount": "2000.00",
            "withdrawal_date": test_day.isoformat(),
        },
    )
    assert wd.status_code == 200, wd.text
    assert _bal(hdfc_uuid) == Decimal("13000.00")
    after_cash = Decimal(str(client.get(f"{P}/bank-accounts/summary", headers=auth_headers).json()["total_cash_available"]))
    assert after_cash == before_cash + Decimal("2000.00")
