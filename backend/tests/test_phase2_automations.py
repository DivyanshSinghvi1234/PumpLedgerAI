from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

P = "/api/v1"


def test_attendance_prorated_payroll(client, auth_headers):
    """Attendance records pro-rate base salary in payroll preview."""
    today = date.today()
    billing_month = today.strftime("%Y-%m")

    e_resp = client.post(
        f"{P}/employees",
        headers=auth_headers,
        json={
            "full_name": "Attendance Worker",
            "role": "OPERATOR",
            "base_salary": "30000.00",
            "commission_rate_per_liter": "0.00",
        },
    )
    assert e_resp.status_code == 201, e_resp.text
    emp_uuid = e_resp.json()["uuid"]

    # Record 1 PRESENT and 1 HALF_DAY => 1.5 days worked
    for day_offset, st in [(0, "PRESENT"), (1, "HALF_DAY")]:
        d = date(today.year, today.month, 1) + timedelta(days=day_offset)
        r = client.post(
            f"{P}/employees/attendance",
            headers=auth_headers,
            json={
                "employee_uuid": emp_uuid,
                "attendance_date": d.isoformat(),
                "status": st,
            },
        )
        assert r.status_code == 200, r.text

    prev = client.get(
        f"{P}/employees/payroll/preview?month={billing_month}",
        headers=auth_headers,
    )
    assert prev.status_code == 200, prev.text
    row = next(r for r in prev.json()["rows"] if r["employee_uuid"] == emp_uuid)
    assert row["days_worked"] == 1.5
    assert Decimal(str(row["prorated_base_salary"])) < Decimal("30000.00")


def test_tanker_indent_landed_cost_and_bank_debit(client, auth_headers):
    """Delivering a PurchaseIndent via BANK computes landed cost/L, updates tank avg_cost_per_liter,
    and debits the selected BankAccount."""
    today = date.today()

    ba_resp = client.post(
        f"{P}/bank-accounts",
        headers=auth_headers,
        json={
            "account_name": "OMC Payment Account",
            "bank_name": "HDFC",
            "account_type": "CURRENT",
            "opening_balance": "500000.00",
        },
    )
    assert ba_resp.status_code == 201
    bank_uuid = ba_resp.json()["uuid"]

    tank_resp = client.post(
        f"{P}/tanks",
        headers=auth_headers,
        json={
            "name": "Indent Cost Tank",
            "fuel_type": "DIESEL",
            "capacity_liters": 20000.0,
            "current_stock_liters": 0.0,
        },
    )
    assert tank_resp.status_code == 201
    tank_uuid = tank_resp.json()["uuid"]

    ind_resp = client.post(
        f"{P}/purchase-indents",
        headers=auth_headers,
        json={
            "omc_company": "IOCL",
            "terminal_name": "Jaipur Depot",
            "fuel_type": "DIESEL",
            "ordered_liters": 4000.0,
            "expected_delivery_date": today.isoformat(),
        },
    )
    assert ind_resp.status_code == 201, ind_resp.text
    indent_uuid = ind_resp.json()["uuid"]

    # Deliver with total_invoice_amount = 360,000 => 90.00/L, paid via BANK
    del_resp = client.put(
        f"{P}/purchase-indents/{indent_uuid}/status",
        headers=auth_headers,
        json={
            "status": "DELIVERED",
            "decanted_tank_uuid": tank_uuid,
            "actual_delivery_date": today.isoformat(),
            "invoice_number": "IOCL-INV-99",
            "total_invoice_amount": 360000.0,
            "payment_mode": "BANK",
            "bank_account_uuid": bank_uuid,
        },
    )
    assert del_resp.status_code == 200, del_resp.text
    assert del_resp.json()["procurement_cost_per_liter"] == 90.0

    # Bank balance = 500,000 - 360,000 = 140,000
    accs = client.get(f"{P}/bank-accounts", headers=auth_headers).json()
    acc = next(a for a in accs if a["uuid"] == bank_uuid)
    assert Decimal(str(acc["current_balance"])) == Decimal("140000.00")


def test_6am_price_autopilot_and_command_center(client, auth_headers):
    """6 AM price schedule creates revision & triggers 6am-alert; Command Center returns P&L,
    Balance Sheet, and 14-day Cashflow Forecast."""
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Set yesterday's rate = 100.00
    r1 = client.post(
        f"{P}/price-schedules",
        headers=auth_headers,
        json={
            "fuel_type": "PETROL",
            "rate": "100.00",
            "effective_from": datetime(
                yesterday.year, yesterday.month, yesterday.day, 6, 0, 0, tzinfo=timezone.utc
            ).isoformat(),
        },
    )
    assert r1.status_code == 201

    # Schedule today's 6 AM revision = 102.50
    r2 = client.post(
        f"{P}/price-schedules/schedule-6am",
        headers=auth_headers,
        json={
            "effective_date": today.isoformat(),
            "petrol_rate": "102.50",
        },
    )
    assert r2.status_code == 201, r2.text

    alert = client.get(
        f"{P}/price-schedules/6am-alert?target_date={today.isoformat()}",
        headers=auth_headers,
    )
    assert alert.status_code == 200, alert.text
    body = alert.json()
    assert body["has_price_change"] is True
    assert body["requires_6am_interim_reading"] is True
    assert any(c["fuel_type"] == "PETROL" and c["diff"] == 2.5 for c in body["changes"])

    # Command Center endpoint
    cc = client.get(f"{P}/command-center?forecast_days=14", headers=auth_headers)
    assert cc.status_code == 200, cc.text
    cc_data = cc.json()
    assert "pnl_today" in cc_data
    assert "pnl_mtd" in cc_data
    assert "balance_sheet" in cc_data
    assert "cashflow_forecast" in cc_data
    assert "net_working_capital" in cc_data["balance_sheet"]
