import pytest
from app.models.pump import Pump
from app.models.customer import Customer
from app.services.whatsapp_digest_service import WhatsAppDigestService


def test_whatsapp_balance_digest_generation(db_session):
    pump = db_session.query(Pump).first()
    if not pump:
        pump = Pump(name="Test WhatsApp Pump", code="TST-WA", address="Test Address")
        db_session.add(pump)
        db_session.flush()

    cust1 = Customer(
        name="Gujarat Fleet Logistics",
        mobile="9876543210",
        opening_balance=15450.0,
        pump_id=pump.id,
    )
    cust2 = Customer(
        name="Zero Balance Transit",
        mobile="9123456789",
        opening_balance=0.0,
        pump_id=pump.id,
    )

    db_session.add_all([cust1, cust2])
    db_session.flush()

    service = WhatsAppDigestService()
    result = service.get_customer_monthly_digest(db_session, min_balance=1.0)

    assert result["total_customers"] >= 1
    assert result["total_outstanding_amount"] >= 15450.0

    items = result["items"]
    names = [i["customer_name"] for i in items]
    assert "Gujarat Fleet Logistics" in names
    assert "Zero Balance Transit" not in names

    fleet_item = next(i for i in items if i["customer_name"] == "Gujarat Fleet Logistics")
    assert "Gujarat Fleet Logistics" in fleet_item["message"]
    assert "₹15,450.00" in fleet_item["message"]
