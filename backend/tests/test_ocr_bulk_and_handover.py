from datetime import date
from decimal import Decimal

P = "/api/v1"


def test_ocr_zero_touch_bulk_approve(client, auth_headers):
    """High-confidence error-free OCR slips are auto-approved into vouchers;
    low-confidence or erroneous slips are skipped for manual review."""
    today = date.today().isoformat()

    payload = {
        "min_confidence": 0.90,
        "items": [
            {
                "ocr": {
                    "provider": "GEMINI",
                    "image_path": "uploads/slip1.jpg",
                    "invoice_number": f"BULK-OK-{today}",
                    "invoice_date": today,
                    "fuel_type": "DIESEL",
                    "quantity_liters": "20.00",
                    "rate_per_liter": "90.00",
                    "total_amount": "1800.00",
                    "confidence": 0.96,
                },
                "validation": {"warnings": [], "errors": []},
                "ready_to_save": True,
            },
            {
                "ocr": {
                    "provider": "GEMINI",
                    "image_path": "uploads/slip2.jpg",
                    "invoice_number": f"BULK-LOWCONF-{today}",
                    "invoice_date": today,
                    "fuel_type": "PETROL",
                    "quantity_liters": "10.00",
                    "rate_per_liter": "100.00",
                    "total_amount": "1000.00",
                    "confidence": 0.65,
                },
                "validation": {"warnings": ["Low confidence"], "errors": []},
                "ready_to_save": False,
            },
        ],
    }

    resp = client.post(f"{P}/vouchers/bulk-approve-ocr", headers=auth_headers, json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["approved_count"] == 1
    assert data["skipped_count"] == 1
    assert data["approved_indices"] == [0]


def test_digital_shift_handover_signoff_and_shortage_posting(client, auth_headers):
    """Outgoing attendant logs shift handover; incoming attendant confirms receipt,
    auto-posting any negative cash variance as a SHORTAGE to outgoing staff's ledger."""
    today = date.today().isoformat()

    e1 = client.post(
        f"{P}/employees",
        headers=auth_headers,
        json={"full_name": "Outgoing Attendant", "role": "OPERATOR", "base_salary": "15000.00"},
    ).json()
    e2 = client.post(
        f"{P}/employees",
        headers=auth_headers,
        json={"full_name": "Incoming Attendant", "role": "OPERATOR", "base_salary": "15000.00"},
    ).json()

    # Log handover with ₹500 shortage (expected 5000, handed 4500)
    h_resp = client.post(
        f"{P}/shifts/handovers",
        headers=auth_headers,
        json={
            "handover_date": today,
            "outgoing_employee_uuid": e1["uuid"],
            "incoming_employee_uuid": e2["uuid"],
            "cash_expected": "5000.00",
            "cash_handed_over": "4500.00",
        },
    )
    assert h_resp.status_code == 201, h_resp.text
    h = h_resp.json()
    assert h["variance"] == -500.0
    assert h["incoming_confirmed"] is False

    # Confirm receipt -> shortage posted to outgoing staff ledger
    c_resp = client.post(
        f"{P}/shifts/handovers/{h['uuid']}/confirm",
        headers=auth_headers,
        json={"auto_post_shortage": True},
    )
    assert c_resp.status_code == 200, c_resp.text
    assert c_resp.json()["incoming_confirmed"] is True
    assert c_resp.json()["shortage_posted"] is True

    ledger = client.get(f"{P}/employees/{e1['uuid']}/ledger", headers=auth_headers).json()
    assert Decimal(str(ledger["outstanding_balance"])) == Decimal("500.00")
