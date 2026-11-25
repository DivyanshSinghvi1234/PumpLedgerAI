from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from urllib.parse import quote
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.repositories.report_repository import ReportRepository
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

    def get_overdue_reminders(
        self,
        db: Session,
        min_age_days: int = 15,
        min_balance: float = 1.0,
        actor_id: int | None = None,
    ) -> dict:
        """Build a bulk WhatsApp reminder queue for customers with overdue credit slips."""
        open_vouchers = ReportRepository().open_credit_vouchers(db)
        today = date.today()
        grouped: dict[str, dict] = {}

        for voucher, customer in open_vouchers:
            due = voucher.balance_due
            if due <= Decimal("0.00"):
                continue

            age_days = (today - voucher.invoice_date).days
            if age_days < min_age_days:
                continue

            key = str(customer.uuid)
            if key not in grouped:
                mobile = getattr(customer, "mobile", None) or ""
                clean_mobile = "".join(filter(str.isdigit, mobile))
                grouped[key] = {
                    "customer_uuid": key,
                    "customer_name": customer.name,
                    "phone": mobile,
                    "clean_mobile": clean_mobile,
                    "overdue_amount": Decimal("0.00"),
                    "overdue_slips": 0,
                    "max_age_days": 0,
                }

            entry = grouped[key]
            entry["overdue_amount"] += due
            entry["overdue_slips"] += 1
            if age_days > entry["max_age_days"]:
                entry["max_age_days"] = age_days

        items = []
        total_overdue = Decimal("0.00")
        for entry in grouped.values():
            amt = entry["overdue_amount"]
            if float(amt) < min_balance:
                continue

            total_overdue += amt
            message = (
                f"Dear {entry['customer_name']}, payment reminder: ₹{amt:,.2f} is overdue "
                f"across {entry['overdue_slips']} fuel slip(s) (oldest {entry['max_age_days']} days). "
                f"Please settle at your earliest convenience. Statement: /statement/{entry['customer_uuid']}"
            )
            wa_phone = entry["clean_mobile"]
            if len(wa_phone) == 10:
                wa_phone = f"91{wa_phone}"
            wa_url = f"https://wa.me/{wa_phone}?text={quote(message)}" if wa_phone else None

            items.append({
                "customer_uuid": entry["customer_uuid"],
                "customer_name": entry["customer_name"],
                "phone": entry["phone"],
                "clean_mobile": entry["clean_mobile"],
                "overdue_amount": float(amt),
                "overdue_slips": entry["overdue_slips"],
                "max_age_days": entry["max_age_days"],
                "message": message,
                "whatsapp_url": wa_url,
            })

        items.sort(key=lambda x: x["overdue_amount"], reverse=True)

        self.audit_service.log_action(
            db,
            action="Generated Bulk Overdue WhatsApp Reminders",
            target_table="customers",
            target_id="overdue_reminders",
            actor_id=actor_id,
            new_values={
                "min_age_days": str(min_age_days),
                "customer_count": str(len(items)),
                "total_overdue": str(total_overdue),
            },
        )

        return {
            "as_of_date": today.isoformat(),
            "min_age_days": min_age_days,
            "total_customers": len(items),
            "total_overdue_amount": float(total_overdue),
            "items": items,
        }
