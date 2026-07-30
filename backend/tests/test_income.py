import pytest
from datetime import date
from decimal import Decimal
from app.core.enums import IncomeKind, PaymentMode
from app.models.income import Income

def test_income_flow(client, auth_headers, db_session):
    # 1. Create an income
    income_resp = client.post(
        "/api/v1/income",
        headers=auth_headers,
        json={
            "kind": "INCOME",
            "income_date": "2026-07-29",
            "description": "Misc scrap sale",
            "amount": 500.0,
            "payment_mode": "CASH",
            "category": "Misc"
        }
    )
    assert income_resp.status_code == 201
    income_data = income_resp.json()
    assert income_data["kind"] == "INCOME"
    assert income_data["description"] == "Misc scrap sale"
    assert float(income_data["amount"]) == 500.0

    # 2. Create a deposit
    deposit_resp = client.post(
        "/api/v1/income",
        headers=auth_headers,
        json={
            "kind": "DEPOSIT",
            "income_date": "2026-07-29",
            "description": "SBI bank deposit",
            "amount": 200.0,
            "payment_mode": "CASH",
            "category": "Bank Deposit"
        }
    )
    assert deposit_resp.status_code == 201
    deposit_data = deposit_resp.json()
    assert deposit_data["kind"] == "DEPOSIT"
    assert float(deposit_data["amount"]) == 200.0

    # 3. Create an expense
    expense_resp = client.post(
        "/api/v1/income",
        headers=auth_headers,
        json={
            "kind": "EXPENSE",
            "income_date": "2026-07-29",
            "description": "Generator repair",
            "amount": 100.0,
            "payment_mode": "CASH",
            "category": "Repairs"
        }
    )
    assert expense_resp.status_code == 201
    expense_data = expense_resp.json()
    assert expense_data["kind"] == "EXPENSE"
    assert float(expense_data["amount"]) == 100.0

    # 4. Get Summary
    summary_resp = client.get(
        "/api/v1/income/summary?on_date=2026-07-29",
        headers=auth_headers
    )
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()
    # total_incomes should be 500.0
    assert float(summary_data["total_incomes"]) == 500.0
    # total_expenses should be 100.0
    assert float(summary_data["total_expenses"]) == 100.0
    # total_deposits should be 200.0
    assert float(summary_data["total_deposits"]) == 200.0
    # cash_in_hand = sales (0) + incomes (500) - expenses (100) - deposits (200) = 200.0
    assert float(summary_data["cash_in_hand"]) == 200.0

    # 5. Update the income
    update_resp = client.put(
        f"/api/v1/income/{income_data['uuid']}",
        headers=auth_headers,
        json={
            "kind": "INCOME",
            "income_date": "2026-07-29",
            "description": "Misc scrap sale updated",
            "amount": 600.0,
            "payment_mode": "CASH",
            "category": "Misc"
        }
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["description"] == "Misc scrap sale updated"
    assert float(updated_data["amount"]) == 600.0

    # Check summary again after update
    summary_resp2 = client.get(
        "/api/v1/income/summary?on_date=2026-07-29",
        headers=auth_headers
    )
    summary_data2 = summary_resp2.json()
    assert float(summary_data2["total_incomes"]) == 600.0
    # cash_in_hand = 0 + 600 - 100 - 200 = 300.0
    assert float(summary_data2["cash_in_hand"]) == 300.0

    # 6. Delete the income
    delete_resp = client.delete(
        f"/api/v1/income/{income_data['uuid']}",
        headers=auth_headers
    )
    assert delete_resp.status_code == 204
    # Note: FastAPI returns 204 No Content for delete_resp

    # Check summary again after delete
    summary_resp3 = client.get(
        "/api/v1/income/summary?on_date=2026-07-29",
        headers=auth_headers
    )
    summary_data3 = summary_resp3.json()
    assert float(summary_data3["total_incomes"]) == 0.0
    # cash_in_hand = 0 + 0 - 100 - 200 = -300.0
    assert float(summary_data3["cash_in_hand"]) == -300.0
