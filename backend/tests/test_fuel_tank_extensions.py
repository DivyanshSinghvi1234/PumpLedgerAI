import pytest
from app.models.fuel_tank import FuelTank, DipReading, TankerDelivery
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading


class TestFuelTankExtensions:

    def test_tank_crud_and_soft_delete(self, client, auth_headers):
        # 1. Create a tank
        create_resp = client.post(
            "/api/v1/tanks",
            headers=auth_headers,
            json={
                "name": "Super Petrol Tank",
                "fuel_type": "PETROL",
                "capacity_liters": 10000.0,
                "current_stock_liters": 5000.0,
            },
        )
        assert create_resp.status_code == 201
        tank = create_resp.json()
        assert tank["name"] == "Super Petrol Tank"
        assert tank["capacity_liters"] == 10000.0
        assert tank["current_stock_liters"] == 5000.0

        # Create a nozzle referencing this tank
        # Need a dispenser first
        disp_resp = client.post(
            "/api/v1/nozzles/dispensers",
            headers=auth_headers,
            json={"name": "Dispenser Alpha"},
        )
        assert disp_resp.status_code == 201
        disp_uuid = disp_resp.json()["uuid"]

        nozzle_resp = client.post(
            f"/api/v1/nozzles/dispensers/{disp_uuid}/nozzles",
            headers=auth_headers,
            json={
                "name": "Nozzle-P1",
                "fuel_type": "PETROL",
                "last_reading": 1000.0,
            },
        )
        assert nozzle_resp.status_code == 201
        nozzle_uuid = nozzle_resp.json()["uuid"]

        # Link nozzle to tank in DB directly
        from app.database.session import SessionLocal
        db = SessionLocal()
        try:
            db_nozzle = db.query(Nozzle).filter(Nozzle.uuid == nozzle_uuid).first()
            db_nozzle.tank_id = tank["id"]
            db.commit()
        finally:
            db.close()

        # 2. Update tank name
        update_resp = client.put(
            f"/api/v1/tanks/{tank['uuid']}",
            headers=auth_headers,
            json={"name": "Updated Tank"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Updated Tank"

        # 3. Downward capacity check (capacity below current stock)
        # capacity: 4000, current stock: 5000 -> should fail with CAPACITY_WARNING
        down_resp = client.put(
            f"/api/v1/tanks/{tank['uuid']}",
            headers=auth_headers,
            json={"capacity_liters": 4000.0},
        )
        assert down_resp.status_code == 400
        assert "CAPACITY_WARNING" in down_resp.json()["detail"]

        # 4. Downward capacity check bypass with ignore_capacity=True
        down_bypass_resp = client.put(
            f"/api/v1/tanks/{tank['uuid']}",
            headers=auth_headers,
            json={"capacity_liters": 4000.0, "ignore_capacity": True},
        )
        assert down_bypass_resp.status_code == 200
        assert down_bypass_resp.json()["capacity_liters"] == 4000.0

        # Restore capacity for subsequent tests
        client.put(
            f"/api/v1/tanks/{tank['uuid']}",
            headers=auth_headers,
            json={"capacity_liters": 10000.0},
        )

        # 5. Soft Delete Tank
        delete_resp = client.delete(
            f"/api/v1/tanks/{tank['uuid']}",
            headers=auth_headers,
        )
        assert delete_resp.status_code == 204

        # Check tank is not listed in active tanks
        list_resp = client.get("/api/v1/tanks", headers=auth_headers)
        assert list_resp.status_code == 200
        tank_uuids = [t["uuid"] for t in list_resp.json()]
        assert tank["uuid"] not in tank_uuids

    def test_delivery_capacity_warnings(self, client, auth_headers):
        # Create a tank
        create_resp = client.post(
            "/api/v1/tanks",
            headers=auth_headers,
            json={
                "name": "Capacity Test Tank",
                "fuel_type": "DIESEL",
                "capacity_liters": 5000.0,
                "current_stock_liters": 4000.0,
            },
        )
        assert create_resp.status_code == 201
        tank = create_resp.json()

        # Try to deliver 2000L (would exceed capacity: 4000 + 2000 = 6000 > 5000)
        delivery_resp = client.post(
            "/api/v1/tanks/deliveries",
            headers=auth_headers,
            json={
                "tank_uuid": tank["uuid"],
                "delivery_date": "2026-07-20",
                "invoice_number": "DEL-101",
                "quantity_liters": 2000.0,
            },
        )
        assert delivery_resp.status_code == 400
        assert "CAPACITY_WARNING" in delivery_resp.json()["detail"]

        # Deliver with ignore_capacity=True
        delivery_bypass_resp = client.post(
            "/api/v1/tanks/deliveries",
            headers=auth_headers,
            json={
                "tank_uuid": tank["uuid"],
                "delivery_date": "2026-07-20",
                "invoice_number": "DEL-101",
                "quantity_liters": 2000.0,
                "ignore_capacity": True,
            },
        )
        assert delivery_bypass_resp.status_code == 201
        assert delivery_bypass_resp.json()["quantity_liters"] == 2000.0

    def test_nozzle_reading_stock_deduction_and_sequential_edits(self, client, auth_headers):
        # Create a tank
        create_resp = client.post(
            "/api/v1/tanks",
            headers=auth_headers,
            json={
                "name": "Deduction Tank",
                "fuel_type": "PETROL",
                "capacity_liters": 10000.0,
                "current_stock_liters": 5000.0,
            },
        )
        assert create_resp.status_code == 201
        tank = create_resp.json()

        # Create dispenser & nozzle
        disp_resp = client.post(
            "/api/v1/nozzles/dispensers",
            headers=auth_headers,
            json={"name": "Dispenser Beta"},
        )
        disp_uuid = disp_resp.json()["uuid"]

        nozzle_resp = client.post(
            f"/api/v1/nozzles/dispensers/{disp_uuid}/nozzles",
            headers=auth_headers,
            json={
                "name": "Nozzle-P2",
                "fuel_type": "PETROL",
                "last_reading": 1000.0,
            },
        )
        nozzle = nozzle_resp.json()

        # Link nozzle to the tank
        from app.database.session import SessionLocal
        db = SessionLocal()
        try:
            db_nozzle = db.query(Nozzle).filter(Nozzle.uuid == nozzle["uuid"]).first()
            db_nozzle.tank_id = tank["id"]
            db.commit()
        finally:
            db.close()

        # 1. Post initial reading: opening=1000.0, closing=1100.0, testing=10.0 -> net sales = 90.0
        post_resp = client.post(
            "/api/v1/nozzles/readings/bulk",
            headers=auth_headers,
            json={
                "reading_date": "2026-07-20",
                "readings": [
                    {
                        "nozzle_uuid": nozzle["uuid"],
                        "opening_reading": 1000.0,
                        "closing_reading": 1100.0,
                        "testing_liters": 10.0,
                    }
                ],
            },
        )
        assert post_resp.status_code in (200, 201)
        # Verification: check returned reading fields
        reading_data = post_resp.json()[0]
        assert reading_data["testing_liters"] == 10.0
        assert reading_data["sales"] == 90.0

        # Check tank stock: 5000.0 - 90.0 = 4910.0
        tank_resp = client.get("/api/v1/tanks", headers=auth_headers)
        target_tank = next(t for t in tank_resp.json() if t["uuid"] == tank["uuid"])
        assert target_tank["current_stock_liters"] == 4910.0

        # 2. Sequential Edit 1: change closing to 1120.0, testing to 20.0 -> net sales = 100.0
        # Stock difference = 100.0 - 90.0 = 10.0. Stock should become 4910.0 - 10.0 = 4900.0
        edit1_resp = client.post(
            "/api/v1/nozzles/readings/bulk",
            headers=auth_headers,
            json={
                "reading_date": "2026-07-20",
                "readings": [
                    {
                        "nozzle_uuid": nozzle["uuid"],
                        "opening_reading": 1000.0,
                        "closing_reading": 1120.0,
                        "testing_liters": 20.0,
                    }
                ],
            },
        )
        assert edit1_resp.status_code in (200, 201)
        assert edit1_resp.json()[0]["sales"] == 100.0

        tank_resp = client.get("/api/v1/tanks", headers=auth_headers)
        target_tank = next(t for t in tank_resp.json() if t["uuid"] == tank["uuid"])
        assert target_tank["current_stock_liters"] == 4900.0

        # 3. Sequential Edit 2: change closing to 1150.0, testing to 10.0 -> net sales = 140.0
        # Stock difference = 140.0 - 100.0 = 40.0. Stock should become 4900.0 - 40.0 = 4860.0
        edit2_resp = client.post(
            "/api/v1/nozzles/readings/bulk",
            headers=auth_headers,
            json={
                "reading_date": "2026-07-20",
                "readings": [
                    {
                        "nozzle_uuid": nozzle["uuid"],
                        "opening_reading": 1000.0,
                        "closing_reading": 1150.0,
                        "testing_liters": 10.0,
                    }
                ],
            },
        )
        assert edit2_resp.status_code in (200, 201)
        assert edit2_resp.json()[0]["sales"] == 140.0

        tank_resp = client.get("/api/v1/tanks", headers=auth_headers)
        target_tank = next(t for t in tank_resp.json() if t["uuid"] == tank["uuid"])
        assert target_tank["current_stock_liters"] == 4860.0

        # 4. Sequential Edit 3: change closing to 1080.0, testing to 0.0 -> net sales = 80.0
        # Stock difference = 80.0 - 140.0 = -60.0. Stock should become 4860.0 - (-60.0) = 4920.0
        edit3_resp = client.post(
            "/api/v1/nozzles/readings/bulk",
            headers=auth_headers,
            json={
                "reading_date": "2026-07-20",
                "readings": [
                    {
                        "nozzle_uuid": nozzle["uuid"],
                        "opening_reading": 1000.0,
                        "closing_reading": 1080.0,
                        "testing_liters": 0.0,
                    }
                ],
            },
        )
        assert edit3_resp.status_code in (200, 201)
        assert edit3_resp.json()[0]["sales"] == 80.0

        tank_resp = client.get("/api/v1/tanks", headers=auth_headers)
        target_tank = next(t for t in tank_resp.json() if t["uuid"] == tank["uuid"])
        assert target_tank["current_stock_liters"] == 4920.0
