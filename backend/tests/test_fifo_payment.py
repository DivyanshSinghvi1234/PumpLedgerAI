"""Tests for FIFO payment allocation bug.

Bug: In allocate_payment_fifo, the ledger is posted with the FULL payment amount
even when only a portion (total_allocated) was applied to vouchers.
This causes customer balance to decrease by the full payment amount
while vouchers only reflect the allocated portion.
"""
from decimal import Decimal


class TestFIFOPaymentAllocation:
    """Test FIFO payment allocation behavior."""

    def test_fifo_allocates_full_amount_when_vouchers_exist(self, client, auth_headers, customer):
        """FIFO should allocate full payment when vouchers have enough balance due."""
        # Create multiple credit vouchers with unique invoice numbers
        voucher_uuids = []
        for i in range(3):
            resp = client.post(
                "/api/v1/vouchers",
                headers=auth_headers,
                json={
                    "invoice_number": f"FIFO_T1_INV{i+1}",
                    "invoice_date": "2026-07-10",
                    "customer_uuid": customer["uuid"],
                    "fuel_type": "DIESEL",
                    "quantity_liters": "10",
                    "rate_per_liter": "50",
                    "total_amount": "500",
                    "payment_mode": "CREDIT",
                },
            )
            assert resp.status_code == 201
            voucher_uuids.append(resp.json()["uuid"])
        
        # Customer balance should be 1000 + 1500 = 2500
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        assert cust_resp.json()["outstanding_balance"] == "2500.00"
        
        # Make payment of 1000 (should fully settle first 2 vouchers, 0 on 3rd)
        payment_resp = client.post(
            "/api/v1/payments/allocate-fifo",
            headers=auth_headers,
            json={
                "customer_uuid": customer["uuid"],
                "amount": "1000",
                "payment_mode": "CASH",
                "payment_date": "2026-07-12",
            },
        )
        assert payment_resp.status_code == 201
        
        # Check voucher statuses
        for i, v_uuid in enumerate(voucher_uuids):
            v_resp = client.get(f"/api/v1/vouchers/{v_uuid}", headers=auth_headers)
            voucher = v_resp.json()
            if i < 2:  # First 2 fully paid
                assert voucher["payment_status"] == "PAID"
                assert voucher["balance_due"] == "0.00"
            else:  # Third gets 0 allocation (1000 - 1000 = 0)
                assert voucher["payment_status"] == "UNPAID"
                assert voucher["balance_due"] == "500.00"
        
        # Customer balance should be 2500 - 1000 = 1500
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        assert cust_resp.json()["outstanding_balance"] == "1500.00"

    def test_fifo_partial_payment_when_insufficient_vouchers(self, client, auth_headers, customer):
        """FIFO should only allocate up to total balance due when payment exceeds vouchers."""
        # Create one voucher for 500
        resp = client.post(
            "/api/v1/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": "FIFO_T2_INV1",
                "invoice_date": "2026-07-10",
                "customer_uuid": customer["uuid"],
                "fuel_type": "DIESEL",
                "quantity_liters": "10",
                "rate_per_liter": "50",
                "total_amount": "500",
                "payment_mode": "CREDIT",
            },
        )
        assert resp.status_code == 201
        
        # Customer balance: 1000 + 500 = 1500
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        assert cust_resp.json()["outstanding_balance"] == "1500.00"
        
        # Pay 2000 - exceeds total due (500)
        payment_resp = client.post(
            "/api/v1/payments/allocate-fifo",
            headers=auth_headers,
            json={
                "customer_uuid": customer["uuid"],
                "amount": "2000",
                "payment_mode": "CASH",
                "payment_date": "2026-07-12",
            },
        )
        assert payment_resp.status_code == 201
        
        # Voucher should be fully paid
        v_resp = client.get(f"/api/v1/vouchers/{resp.json()['uuid']}", headers=auth_headers)
        assert v_resp.json()["payment_status"] == "PAID"
        assert v_resp.json()["balance_due"] == "0.00"
        
        # BUG: Customer balance will be 1500 - 2000 = -500 (negative!)
        # But only 500 was actually applied to vouchers
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        balance = Decimal(cust_resp.json()["outstanding_balance"])
        # Should be 1500 - 500 = 1000, but bug makes it -500
        assert balance == Decimal("1000.00"), f"Balance should be 1000 (1500 - 500 allocated), got {balance}"

    def test_fifo_no_vouchers_should_not_post_ledger(self, client, auth_headers, customer):
        """FIFO with no outstanding vouchers should not reduce customer balance."""
        # Customer has opening balance 1000, no credit vouchers
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        assert cust_resp.json()["outstanding_balance"] == "1000.00"
        
        # Try FIFO payment
        payment_resp = client.post(
            "/api/v1/payments/allocate-fifo",
            headers=auth_headers,
            json={
                "customer_uuid": customer["uuid"],
                "amount": "500",
                "payment_mode": "CASH",
                "payment_date": "2026-07-12",
            },
        )
        # Currently returns 201 but shouldn't post ledger
        assert payment_resp.status_code == 201
        
        # BUG: Balance becomes 500 (1000 - 500) but no vouchers were settled
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        balance = Decimal(cust_resp.json()["outstanding_balance"])
        # Should remain 1000 since no vouchers to settle
        assert balance == Decimal("1000.00"), f"Balance should remain 1000 (no vouchers), got {balance}"


class TestVoucherSettle:
    """Test single voucher settlement endpoint."""

    def test_settle_voucher_full(self, client, auth_headers, customer):
        """Settle a voucher fully."""
        v_resp = client.post(
            "/api/v1/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": "SETTLE_T1_INV1",
                "invoice_date": "2026-07-10",
                "customer_uuid": customer["uuid"],
                "fuel_type": "DIESEL",
                "quantity_liters": "10",
                "rate_per_liter": "50",
                "total_amount": "500",
                "payment_mode": "CREDIT",
            },
        )
        assert v_resp.status_code == 201
        voucher_uuid = v_resp.json()["uuid"]
        
        # Settle full amount
        settle_resp = client.post(
            f"/api/v1/vouchers/{voucher_uuid}/settle",
            headers=auth_headers,
            json={"amount": "500", "payment_mode": "CASH", "payment_date": "2026-07-12"},
        )
        assert settle_resp.status_code == 200
        
        v_resp = client.get(f"/api/v1/vouchers/{voucher_uuid}", headers=auth_headers)
        assert v_resp.json()["payment_status"] == "PAID"
        assert v_resp.json()["balance_due"] == "0.00"
        
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        assert cust_resp.json()["outstanding_balance"] == "1000.00"  # 1500 - 500

    def test_settle_voucher_partial(self, client, auth_headers, customer):
        """Partial settlement should work."""
        v_resp = client.post(
            "/api/v1/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": "SETTLE_T2_INV1",
                "invoice_date": "2026-07-10",
                "customer_uuid": customer["uuid"],
                "fuel_type": "DIESEL",
                "quantity_liters": "10",
                "rate_per_liter": "50",
                "total_amount": "500",
                "payment_mode": "CREDIT",
            },
        )
        assert v_resp.status_code == 201
        voucher_uuid = v_resp.json()["uuid"]
        
        # Settle partial
        settle_resp = client.post(
            f"/api/v1/vouchers/{voucher_uuid}/settle",
            headers=auth_headers,
            json={"amount": "200", "payment_mode": "CASH", "payment_date": "2026-07-12"},
        )
        assert settle_resp.status_code == 200
        
        v_resp = client.get(f"/api/v1/vouchers/{voucher_uuid}", headers=auth_headers)
        assert v_resp.json()["payment_status"] == "PARTIAL"
        assert v_resp.json()["balance_due"] == "300.00"
        
        cust_resp = client.get(f"/api/v1/customers/{customer['uuid']}", headers=auth_headers)
        assert cust_resp.json()["outstanding_balance"] == "1300.00"  # 1500 - 200


class TestVehicleLedger:
    """Vehicle-level ledger view and vehicle-scoped FIFO settlement."""

    def _make_voucher(self, client, auth_headers, customer, inv, vehicle_number):
        resp = client.post(
            "/api/v1/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": inv,
                "invoice_date": "2026-07-10",
                "customer_uuid": customer["uuid"],
                "vehicle_number": vehicle_number,
                "fuel_type": "DIESEL",
                "quantity_liters": "10",
                "rate_per_liter": "50",
                "total_amount": "500",
                "payment_mode": "CREDIT",
            },
        )
        assert resp.status_code == 201
        return resp.json()

    def _vehicle_uuid(self, client, auth_headers, vehicle_number):
        resp = client.get(
            "/api/v1/vehicles",
            headers=auth_headers,
            params={"search": vehicle_number},
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert items, f"vehicle {vehicle_number} not found"
        return items[0]["uuid"]

    def test_vehicle_ledger_scopes_vouchers_and_outstanding(
        self, client, auth_headers, customer
    ):
        # Two vouchers on vehicle A, one on vehicle B.
        self._make_voucher(client, auth_headers, customer, "VL_A1", "MH20AA0001")
        self._make_voucher(client, auth_headers, customer, "VL_A2", "MH20AA0001")
        self._make_voucher(client, auth_headers, customer, "VL_B1", "MH20BB0002")

        veh_a = self._vehicle_uuid(client, auth_headers, "MH20AA0001")

        resp = client.get(
            f"/api/v1/vehicles/{veh_a}/ledger", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        # Only vehicle A's two vouchers, with SUM(balance_due) = 1000.
        assert body["voucher_count"] == 2
        assert len(body["vouchers"]) == 2
        assert body["outstanding"] == "1000.00"
        assert body["vehicle_number"] == "MH20AA0001"

    def test_vehicle_list_and_detail_expose_live_outstanding(
        self, client, auth_headers, customer
    ):
        self._make_voucher(client, auth_headers, customer, "VLO_1", "MH20EE0005")
        self._make_voucher(client, auth_headers, customer, "VLO_2", "MH20EE0005")

        # List view carries the live per-vehicle outstanding.
        listed = client.get(
            "/api/v1/vehicles",
            headers=auth_headers,
            params={"search": "MH20EE0005"},
        ).json()["items"]
        assert listed
        veh = listed[0]
        assert veh["outstanding_balance"] == "1000.00"

        # Detail view agrees.
        detail = client.get(
            f"/api/v1/vehicles/{veh['uuid']}", headers=auth_headers
        ).json()
        assert detail["outstanding_balance"] == "1000.00"

    def test_vehicle_ledger_404_for_unknown(self, client, auth_headers):
        resp = client.get(
            "/api/v1/vehicles/00000000-0000-0000-0000-000000000000/ledger",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_fifo_scoped_to_vehicle_only_settles_that_vehicle(
        self, client, auth_headers, customer
    ):
        self._make_voucher(client, auth_headers, customer, "VLF_A1", "MH20CC0003")
        self._make_voucher(client, auth_headers, customer, "VLF_B1", "MH20DD0004")

        veh_a = self._vehicle_uuid(client, auth_headers, "MH20CC0003")
        veh_b = self._vehicle_uuid(client, auth_headers, "MH20DD0004")

        # Pay 500 scoped to vehicle A: only A's voucher should be settled.
        pay = client.post(
            "/api/v1/payments/allocate-fifo",
            headers=auth_headers,
            json={
                "customer_uuid": customer["uuid"],
                "amount": "500",
                "payment_mode": "CASH",
                "payment_date": "2026-07-12",
                "vehicle_uuid": veh_a,
            },
        )
        assert pay.status_code == 201

        a_ledger = client.get(
            f"/api/v1/vehicles/{veh_a}/ledger", headers=auth_headers
        ).json()
        b_ledger = client.get(
            f"/api/v1/vehicles/{veh_b}/ledger", headers=auth_headers
        ).json()

        assert a_ledger["outstanding"] == "0.00"
        assert b_ledger["outstanding"] == "500.00"

    def test_voucher_response_exposes_vehicle_uuid(
        self, client, auth_headers, customer
    ):
        """A vehicle-tagged voucher carries the linked vehicle's uuid so the
        client can deep-link to its ledger; an untagged voucher reports null."""
        tagged = self._make_voucher(
            client, auth_headers, customer, "VUUID_1", "MH20FF0006"
        )
        veh = self._vehicle_uuid(client, auth_headers, "MH20FF0006")

        assert tagged["vehicle_uuid"] == veh

        # Re-fetch through the detail endpoint to confirm serialization there.
        detail = client.get(
            f"/api/v1/vouchers/{tagged['uuid']}", headers=auth_headers
        ).json()
        assert detail["vehicle_uuid"] == veh

        # A voucher with no vehicle reports a null uuid.
        untagged = client.post(
            "/api/v1/vouchers",
            headers=auth_headers,
            json={
                "invoice_number": "VUUID_2",
                "invoice_date": "2026-07-10",
                "customer_uuid": customer["uuid"],
                "fuel_type": "DIESEL",
                "quantity_liters": "10",
                "rate_per_liter": "50",
                "total_amount": "500",
                "payment_mode": "CREDIT",
            },
        )
        assert untagged.status_code == 201
        assert untagged.json()["vehicle_uuid"] is None

    def test_fifo_scoped_to_vehicle_number_string(
        self, client, auth_headers, customer
    ):
        """FIFO payment using vehicle_number string should settle that vehicle's vouchers and update vehicle ledger."""
        self._make_voucher(client, auth_headers, customer, "VSTR_A1", "RJ01AA1111")
        self._make_voucher(client, auth_headers, customer, "VSTR_B1", "RJ01BB2222")

        veh_a = self._vehicle_uuid(client, auth_headers, "RJ01AA1111")
        veh_b = self._vehicle_uuid(client, auth_headers, "RJ01BB2222")

        # Pay 500 specifying vehicle_number string (without vehicle_uuid)
        pay = client.post(
            "/api/v1/payments/allocate-fifo",
            headers=auth_headers,
            json={
                "customer_uuid": customer["uuid"],
                "amount": "500",
                "payment_mode": "CASH",
                "payment_date": "2026-07-12",
                "vehicle_number": "RJ 01 AA 1111",
            },
        )
        assert pay.status_code == 201

        a_ledger = client.get(
            f"/api/v1/vehicles/{veh_a}/ledger", headers=auth_headers
        ).json()
        b_ledger = client.get(
            f"/api/v1/vehicles/{veh_b}/ledger", headers=auth_headers
        ).json()

        assert a_ledger["outstanding"] == "0.00"
        assert b_ledger["outstanding"] == "500.00"