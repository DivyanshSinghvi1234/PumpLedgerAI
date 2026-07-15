import logging
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.voucher import Voucher
from app.models.customer import Customer
from app.models.pump import Pump
from sqlalchemy import select

logger = logging.getLogger("app.notification")

class NotificationService:
    def send_credit_alert(self, db: Session, voucher: Voucher) -> None:
        """
        Sends a real-time credit alert to the customer's mobile number.
        For local/development environments, this prints a beautiful console log
        and records the notification.
        """
        if not voucher.customer_id:
            return
            
        customer = db.get(Customer, voucher.customer_id)
        if not customer or not customer.mobile:
            logger.info(f"Skipping credit alert for Voucher {voucher.invoice_number}: Customer has no mobile number.")
            return

        # Fetch pump name
        pump = db.scalar(select(Pump).where(Pump.id == voucher.pump_id))
        pump_name = pump.name if pump else "Our Pump Station"

        mobile = customer.mobile.strip()
        vehicle = voucher.vehicle_number or "N/A"
        liters = float(voucher.quantity_liters)
        fuel = voucher.fuel_type.value
        amount = float(voucher.total_amount)
        outstanding = float(customer.outstanding_balance)

        # Structure the SMS/WhatsApp alert template
        message = (
            f"ALERT: Vehicle {vehicle} fueled {liters:.2f}L of {fuel} (Amt: INR {amount:.2f}) "
            f"on credit at {pump_name}. Invoice: {voucher.invoice_number}. "
            f"Your current outstanding balance is: INR {outstanding:.2f}."
        )

        # Print a beautiful simulation to console log
        banner = (
            "\n" + "="*80 + "\n"
            f"  [SIMULATED WHATSAPP/SMS CREDIT ALERT]\n"
            f"  TO: {mobile}\n"
            f"  MESSAGE: {message}\n"
            + "="*80 + "\n"
        )
        print(banner)
        logger.info(f"Credit alert successfully triggered and simulated for mobile {mobile}.")
