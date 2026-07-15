"""Phase 8 end-to-end smoke test — exercises every module through the real
HTTP layer (auth, role gates, serialization) against a fresh DB."""
import os
import tempfile

# Point at a fresh temp DB BEFORE importing the app.
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.close(_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ["DEBUG"] = "False"  # silence SQL echo

from fastapi.testclient import TestClient  # noqa: E402
import app.main as main  # noqa: E402
from app.database.init_db import init_db  # noqa: E402

# Create tables + seed admin against the fresh temp DB.
init_db()

client = TestClient(main.app)
P = "/api/v1"


def login(username="admin", password="admin123"):
    r = client.post(
        f"{P}/auth/login",
        json={"username": username, "password": password},
    )
    assert r.status_code == 200, (r.status_code, r.text)
    return r.json()["access_token"]


def auth(token, pump_uuid=None):
    headers = {"Authorization": f"Bearer {token}"}
    if pump_uuid:
        headers["X-Pump-UUID"] = pump_uuid
    return headers


results = []

def check(name, cond, detail=""):
    results.append((name, cond, detail))
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")


# ---- 1. Auth ----
r = client.post(f"{P}/auth/login", json={"username": "admin", "password": "wrongpass"})
check("login rejects bad password", r.status_code in (400, 401), r.status_code)

token = login()
check("login admin ok", bool(token))

r_pumps = client.get(f"{P}/pumps", headers={"Authorization": f"Bearer {token}"})
check("get pumps ok", r_pumps.status_code == 200, r_pumps.text)
pumps = r_pumps.json()
pump_uuid = pumps[0]["uuid"] if pumps else None

H = auth(token, pump_uuid)

# Protected route without token -> 401
r = client.get(f"{P}/customers")
check("no-token customers 401", r.status_code == 401, r.status_code)

# ---- 2. Customer ----
r = client.post(f"{P}/customers", headers=H, json={"name": "Acme Traders", "opening_balance": "1000.00"})
check("create customer 201", r.status_code == 201, r.text)
cust = r.json()
cust_uuid = cust["uuid"]
check("customer outstanding = opening 1000", cust["outstanding_balance"] == "1000.00", cust.get("outstanding_balance"))

r = client.get(f"{P}/customers", headers=H)
check("list customers paginated", r.status_code == 200 and r.json()["pagination"]["total_items"] == 1, r.text[:200])

# Regression: the customer-options dropdown fetches page_size=1000.
r = client.get(f"{P}/customers", headers=H, params={"page": 1, "page_size": 1000})
check("customers page_size=1000 (dropdown)", r.status_code == 200, f"{r.status_code} {r.text[:150]}")

# ---- 3. Vehicle ----
r = client.post(f"{P}/vehicles", headers=H, json={"customer_uuid": cust_uuid, "vehicle_number": "MH12AB1234", "vehicle_type": "Truck"})
check("create vehicle 201", r.status_code == 201, r.text)
veh = r.json()
check("vehicle embeds customer_name", veh.get("customer_name") == "Acme Traders", veh)

r = client.get(f"{P}/vehicles", headers=H)
check("list vehicles paginated", r.status_code == 200 and r.json()["pagination"]["total_items"] == 1, r.text[:200])

# ---- 4. Voucher (credit, linked) ----
r = client.post(f"{P}/vouchers", headers=H, json={
    "invoice_number": "INV1", "invoice_date": "2026-07-10",
    "customer_uuid": cust_uuid, "vehicle_number": "MH12AB1234",
    "fuel_type": "DIESEL", "quantity_liters": "10", "rate_per_liter": "50",
    "total_amount": "500", "payment_mode": "CREDIT",
})
check("create credit voucher 201", r.status_code == 201, r.text)
v = r.json()
check("voucher total computed 500", v["total_amount"] == "500.00", v.get("total_amount"))
check("voucher linked customer_uuid", v.get("customer_uuid") == cust_uuid, v.get("customer_uuid"))
voucher_uuid = v["uuid"]

# credit voucher should raise balance to 1500
r = client.get(f"{P}/customers/{cust_uuid}", headers=H)
check("balance after credit voucher = 1500", r.json()["outstanding_balance"] == "1500.00", r.json().get("outstanding_balance"))

# cash walk-in voucher (no ledger effect)
r = client.post(f"{P}/vouchers", headers=H, json={
    "invoice_number": "INV2", "invoice_date": "2026-07-11",
    "customer_name": "Walk In", "fuel_type": "PETROL",
    "quantity_liters": "5", "rate_per_liter": "100",
    "total_amount": "500", "payment_mode": "CASH",
})
check("create cash voucher 201", r.status_code == 201, r.text)

# Regression: the vouchers list page sends empty-string filter params.
r = client.get(
    f"{P}/vouchers",
    headers=H,
    params={"search": "", "fuel_type": "", "payment_mode": "", "page": 1, "page_size": 20},
)
check("vouchers empty filter params", r.status_code == 200 and r.json()["pagination"]["total_items"] == 2, f"{r.status_code} {r.text[:150]}")
# And a real filter still works.
r = client.get(f"{P}/vouchers", headers=H, params={"fuel_type": "DIESEL"})
check("vouchers filter DIESEL", r.status_code == 200 and r.json()["pagination"]["total_items"] == 1, r.text[:150])

# ---- 5. Payment ----
r = client.post(f"{P}/payments", headers=H, json={
    "customer_uuid": cust_uuid, "amount": "200", "payment_mode": "CASH",
    "payment_date": "2026-07-12", "reference_number": "R1",
})
check("create payment 201", r.status_code == 201, r.text)
payment_uuid = r.json()["uuid"]

r = client.get(f"{P}/customers/{cust_uuid}", headers=H)
check("balance after payment 200 = 1300", r.json()["outstanding_balance"] == "1300.00", r.json().get("outstanding_balance"))

# ---- 6. Ledger + adjustment ----
r = client.get(f"{P}/customers/{cust_uuid}/ledger", headers=H)
check("ledger lists entries", r.status_code == 200 and r.json()["closing_balance"] == "1300.00", r.text[:200])

r = client.post(f"{P}/customers/{cust_uuid}/ledger/adjustments", headers=H, json={
    "entry_type": "DEBIT_ADJUSTMENT", "amount": "100", "entry_date": "2026-07-12", "remarks": "late fee",
})
check("post debit adjustment 201", r.status_code == 201, r.text)
r = client.get(f"{P}/customers/{cust_uuid}", headers=H)
check("balance after debit adj 100 = 1400", r.json()["outstanding_balance"] == "1400.00", r.json().get("outstanding_balance"))

# ---- 7. Dashboard ----
r = client.get(f"{P}/dashboard", headers=H)
check("dashboard 200", r.status_code == 200, r.text[:200])
d = r.json()
check("dashboard has today_vouchers", "today_vouchers" in d["summary"], d.get("summary"))
check("dashboard recent_vouchers serialized", isinstance(d["recent_vouchers"], list) and len(d["recent_vouchers"]) == 2, len(d.get("recent_vouchers", [])))

# ---- 8. Reports ----
r = client.get(f"{P}/reports/vouchers", headers=H)
check("voucher report", r.status_code == 200 and r.json()["count"] == 2, r.text[:200])

r = client.get(f"{P}/reports/customers", headers=H)
check("customer report outstanding 1400", r.status_code == 200 and r.json()["total_outstanding"] == "1400.00", r.text[:200])

r = client.get(f"{P}/reports/daily-sales", params={"on_date": "2026-07-10"}, headers=H)
check("daily sales 7/10 = 500", r.status_code == 200 and r.json()["total_sales"] == "500.00", r.text[:200])

r = client.get(f"{P}/reports/ledger/{cust_uuid}", headers=H)
check("ledger report closing 1400", r.status_code == 200 and r.json()["closing_balance"] == "1400.00", r.text[:200])

# CSV exports
for path, fname in [
    (f"{P}/reports/vouchers/export", "voucher"),
    (f"{P}/reports/customers/export", "customer"),
    (f"{P}/reports/ledger/{cust_uuid}/export", "ledger"),
    (f"{P}/reports/daily-sales/export", "daily"),
]:
    r = client.get(path, headers=H)
    ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("text/csv")
    check(f"csv export {fname}", ok, f"{r.status_code} {r.headers.get('content-type')}")

# ---- 9. Voucher delete reverses ledger ----
r = client.delete(f"{P}/vouchers/{voucher_uuid}", headers=H)
check("delete credit voucher 204", r.status_code == 204, r.status_code)
r = client.get(f"{P}/customers/{cust_uuid}", headers=H)
check("balance after voucher delete = 900", r.json()["outstanding_balance"] == "900.00", r.json().get("outstanding_balance"))

# ---- 10. Payment delete restores ----
r = client.delete(f"{P}/payments/{payment_uuid}", headers=H)
check("delete payment 204", r.status_code == 204, r.status_code)
r = client.get(f"{P}/customers/{cust_uuid}", headers=H)
check("balance after payment delete = 1100", r.json()["outstanding_balance"] == "1100.00", r.json().get("outstanding_balance"))

# ---- 11. Tally Export ----
r = client.post(f"{P}/customers", headers=H, json={"name": "Tally Corp", "opening_balance": "0.00"})
check("create tally customer 201", r.status_code == 201, r.text)
tc_uuid = r.json()["uuid"]

r = client.post(f"{P}/vouchers", headers=H, json={
    "invoice_number": "TINV1", "invoice_date": "2026-07-13",
    "customer_uuid": tc_uuid, "fuel_type": "PETROL", "quantity_liters": "10", "rate_per_liter": "100",
    "total_amount": "1000", "payment_mode": "CREDIT",
})
check("create credit voucher for tally 201", r.status_code == 201, r.text)
tv_uuid = r.json()["uuid"]

r = client.post(f"{P}/vouchers/{tv_uuid}/verify", headers=H)
check("verify tally voucher 200", r.status_code == 200, r.text)

r = client.post(f"{P}/payments", headers=H, json={
    "customer_uuid": tc_uuid, "amount": "300", "payment_mode": "UPI",
    "payment_date": "2026-07-13", "reference_number": "UPITALLY1",
})
check("create payment for tally 201", r.status_code == 201, r.text)
tp_uuid = r.json()["uuid"]

tally_req = {
    "from_date": "2026-07-13",
    "to_date": "2026-07-13",
    "mark_as_synced": False,
    "ledger_mappings": {
        "cash_ledger": "Cash A/c",
        "upi_ledger": "UPI Bank A/c",
        "card_ledger": "Card Bank A/c",
        "petrol_sales_ledger": "Petrol Revenue",
        "diesel_sales_ledger": "Diesel Revenue",
        "lubricant_sales_ledger": "Lube Revenue"
    },
    "voucher_types": {
        "sales": "Sales",
        "receipt": "Receipt"
    }
}
r = client.post(f"{P}/tally/preview", headers=H, json=tally_req)
check("tally preview response 200", r.status_code == 200, r.text)
preview = r.json()
check("preview voucher count = 1", preview["total_vouchers"] == 1, preview)
check("preview payment count = 1", preview["total_payments"] == 1, preview)
check("preview total sales = 1000.00", preview["total_sales_amount"] == "1000.00", preview)
check("preview total receipts = 300.00", preview["total_receipts_amount"] == "300.00", preview)

r = client.post(f"{P}/tally/export", headers=H, json=tally_req)
check("tally export xml 200", r.status_code == 200, r.text[:200])
xml_data = r.text
check("xml has ENVELOPE tag", "<ENVELOPE>" in xml_data, xml_data[:100])
check("xml has Petrol Revenue ledger", "Petrol Revenue" in xml_data, xml_data)
check("xml has Tally Corp ledger", "Tally Corp" in xml_data, xml_data)
check("xml has UPI Bank A/c ledger", "UPI Bank A/c" in xml_data, xml_data)
check("xml has ISDEEMEDPOSITIVE", "ISDEEMEDPOSITIVE" in xml_data, xml_data)

r = client.get(f"{P}/vouchers/{tv_uuid}", headers=H)
check("voucher tally status still PENDING", r.json()["tally_status"] == "PENDING", r.json().get("tally_status"))

tally_req["mark_as_synced"] = True
r = client.post(f"{P}/tally/export", headers=H, json=tally_req)
check("tally export with sync 200", r.status_code == 200, r.text[:200])

r = client.get(f"{P}/vouchers/{tv_uuid}", headers=H)
check("voucher tally status updated to SYNCED", r.json()["tally_status"] == "SYNCED", r.json().get("tally_status"))

tally_req["mark_as_synced"] = False
r = client.post(f"{P}/tally/preview", headers=H, json=tally_req)
check("tally preview empty after sync", r.json()["total_vouchers"] == 0 and r.json()["total_payments"] == 0, r.json())

# ---- Price Schedules ----
r = client.post(f"{P}/price-schedules", headers=H, json={
    "fuel_type": "PETROL", "rate": "100.50", "effective_from": "2026-07-16T00:00:00Z"
})
check("create price schedule 201", r.status_code == 201, r.text)
ps_uuid = r.json()["uuid"]

r = client.get(f"{P}/price-schedules", headers=H)
check("list price schedules", r.status_code == 200 and len(r.json()) > 0, r.text)

r = client.delete(f"{P}/price-schedules/{ps_uuid}", headers=H)
check("delete price schedule 204", r.status_code == 204, r.status_code)

# ---- Daily Sheets ----
r = client.get(f"{P}/daily-sheets/2026-07-15", headers=H)
check("get nonexistent daily sheet 200 (null)", r.status_code == 200 and r.json() is None, r.text)

r = client.post(f"{P}/daily-sheets", headers=H, json={
    "date": "2026-07-15",
    "remarks": "Test daily sheet remarks"
})
check("create daily sheet 201", r.status_code == 201, r.text)
ds_uuid = r.json()["uuid"]

r = client.get(f"{P}/daily-sheets/2026-07-15", headers=H)
check("get created daily sheet 200", r.status_code == 200 and r.json()["uuid"] == ds_uuid, r.text)

r = client.put(f"{P}/daily-sheets/{ds_uuid}", headers=H, json={
    "remarks": "Updated remarks from test",
    "manual_sheet_image": None
})
check("update daily sheet remarks 200", r.status_code == 200 and r.json()["remarks"] == "Updated remarks from test", r.text)

r = client.post(
    f"{P}/daily-sheets/{ds_uuid}/upload",
    headers=H,
    files={"file": ("test.png", b"fakeimagebytes", "image/png")}
)
check("upload manual sheet image 200", r.status_code == 200 and "daily-sheets" in r.json()["manual_sheet_image"], r.text)

# ---- Summary ----
passed = sum(1 for _, c, _ in results if c)
total = len(results)
print(f"\n==== {passed}/{total} checks passed ====")
if passed != total:
    print("FAILURES:")
    for name, c, detail in results:
        if not c:
            print(" -", name, detail)
    raise SystemExit(1)
print("ALL E2E SMOKE CHECKS PASSED")

# cleanup
try:
    os.remove(_db_path)
except OSError:
    pass
