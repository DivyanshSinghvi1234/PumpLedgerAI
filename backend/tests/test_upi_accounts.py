from datetime import date
from decimal import Decimal

P = "/api/v1"


def test_upi_accounts_crud_and_bank_linkage(client, auth_headers):
    """Tests:
    1. Creating multiple named UPI accounts (PhonePe, Paytm) linked to different banks (HDFC, SBI)
    2. Updating a UPI account name/provider/bank
    3. Soft-deleting a UPI account
    """
    hdfc = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "HDFC Main",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "5000.00",
        },
    ).json()

    sbi = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "SBI Fuel",
            "bank_name": "SBI",
            "account_type": "CURRENT",
            "opening_balance": "3000.00",
        },
    ).json()

    # Create two UPI accounts with custom names and different providers
    u1_res = client.post(
        f"{P}/bank-accounts/upi",
        headers=auth_headers,
        json={
            "name": "Forecourt PhonePe QR",
            "provider": "PHONEPE",
            "upi_id": "sardarji@ybl",
            "bank_account_uuid": hdfc["uuid"],
        },
    )
    assert u1_res.status_code == 201, u1_res.text
    u1 = u1_res.json()
    assert u1["name"] == "Forecourt PhonePe QR"
    assert u1["provider"] == "PHONEPE"
    assert u1["bank_account_uuid"] == hdfc["uuid"]
    assert u1["bank_name"] == "HDFC"

    u2_res = client.post(
        f"{P}/bank-accounts/upi",
        headers=auth_headers,
        json={
            "name": "Office Paytm",
            "provider": "PAYTM",
            "upi_id": "office@paytm",
            "bank_account_uuid": sbi["uuid"],
        },
    )
    assert u2_res.status_code == 201, u2_res.text
    u2 = u2_res.json()
    assert u2["bank_name"] == "SBI"

    # List UPI accounts
    listed = client.get(f"{P}/bank-accounts/upi", headers=auth_headers).json()
    names = {x["name"] for x in listed}
    assert {"Forecourt PhonePe QR", "Office Paytm"}.issubset(names)

    # Update u2
    upd = client.patch(
        f"{P}/bank-accounts/upi/{u2['uuid']}",
        headers=auth_headers,
        json={"name": "Office GPay", "provider": "GPAY", "bank_account_uuid": hdfc["uuid"]},
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["name"] == "Office GPay"
    assert upd.json()["provider"] == "GPAY"
    assert upd.json()["bank_account_uuid"] == hdfc["uuid"]

    # Delete u1
    del_res = client.delete(f"{P}/bank-accounts/upi/{u1['uuid']}", headers=auth_headers)
    assert del_res.status_code == 204

    after = client.get(f"{P}/bank-accounts/upi", headers=auth_headers).json()
    assert all(x["uuid"] != u1["uuid"] for x in after)
