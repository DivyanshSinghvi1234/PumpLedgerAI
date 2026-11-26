from datetime import date
from decimal import Decimal

P = "/api/v1"


def test_cash_flow_report_money_in_vs_money_out(client, auth_headers):
    """Tests GET /api/v1/reports/cash-flow aggregates Money In and Money Out."""
    today = date.today().isoformat()

    cust = client.post(
        f"{P}/customers",
        headers=auth_headers,
        json={"name": "CashFlow Cust", "mobile": "9876500888"},
    ).json()

    # Cash voucher (+2,000)
    v_res = client.post(
        f"{P}/vouchers",
        headers=auth_headers,
        json={
            "customer_uuid": cust["uuid"],
            "invoice_number": "INV-CF-001",
            "invoice_date": today,
            "fuel_type": "DIESEL",
            "quantity_liters": "20.00",
            "rate_per_liter": "100.00",
            "total_amount": "2000.00",
            "payment_mode": "CASH",
        },
    )
    assert v_res.status_code in (200, 201), v_res.text

    # Operating expense (-500)
    e_res = client.post(
        f"{P}/income",
        headers=auth_headers,
        json={
            "kind": "EXPENSE",
            "income_date": today,
            "description": "Office Tea",
            "amount": "500.00",
            "category": "Misc",
            "payment_mode": "CASH",
        },
    )
    assert e_res.status_code in (200, 201), e_res.text

    cf = client.get(
        f"{P}/reports/cash-flow",
        params={"from_date": today, "to_date": today},
        headers=auth_headers,
    )
    assert cf.status_code == 200, cf.text
    data = cf.json()
    assert Decimal(str(data["money_in"]["cash_sales"])) >= Decimal("2000.00")
    assert Decimal(str(data["money_out"]["operating_expenses"])) >= Decimal("500.00")
    assert Decimal(str(data["net_cash_flow"])) == Decimal(str(data["total_in"])) - Decimal(str(data["total_out"]))
