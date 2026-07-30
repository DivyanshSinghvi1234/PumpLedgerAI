from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.services.ledger_service import LedgerService
from app.services.audit_log_service import AuditLogService


class WhatsAppDigestService:

    def __init__(self):
        self.ledger_service = LedgerService()
        self.audit_service = AuditLogService()

    def get_customer_monthly_digest(
        self,
        db: Session,
        min_balance: float = 1.0,
        actor_id: int | None = None,
    ) -> dict:
        customers = db.scalars(
            select(Customer).where(Customer.is_active.is_(True))
        ).all()

        current_month_str = datetime.now().strftime("%B %Y")
        digest_items = []
        total_outstanding = 0.0

        for cust in customers:
            balance = float(cust.outstanding_balance if cust.outstanding_balance and cust.outstanding_balance > 0 else (cust.opening_balance or 0.0))

            if balance >= min_balance:
                total_outstanding += balance
                mobile = getattr(cust, "mobile", None) or getattr(cust, "phone", None) or ""
                clean_mobile = "".join(filter(str.isdigit, mobile))


                message = (
                    f"Dear {cust.name}, your account balance statement for {current_month_str} "
                    f"is ₹{balance:,.2f}. Please review your statement link: "
                    f"/statement/{cust.uuid}"
                )

                digest_items.append({
                    "customer_id": cust.id,
                    "customer_uuid": cust.uuid,
                    "customer_name": cust.name,
                    "phone": mobile,
                    "clean_mobile": clean_mobile,
                    "closing_balance": balance,
                    "message": message,
                })


        # Sort by balance descending
        digest_items.sort(key=lambda x: x["closing_balance"], reverse=True)

        self.audit_service.log_action(
            db,
            action="Generated WhatsApp Balance Digest",
            target_table="customers",
            target_id="monthly_digest",
            actor_id=actor_id,
            new_values={
                "customer_count": str(len(digest_items)),
                "total_outstanding": str(total_outstanding),
            }
        )

        return {
            "month_year": current_month_str,
            "total_customers": len(digest_items),
            "total_outstanding_amount": total_outstanding,
            "items": digest_items,
        }
