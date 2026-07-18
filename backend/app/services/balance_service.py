from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories.ledger_repository import LedgerRepository
from app.repositories.voucher_repository import VoucherRepository


class BalanceService:
    """Live balance read model.

    Both balances are derived from the same underlying rows so the customer
    and vehicle views can never disagree:

    * **Customer outstanding** is the signed sum of the customer's ledger
      entries (opening balance + credit-sale debits − payments ± adjustments).
      This is the authoritative definition the system has always used; reading
      it live means it can't drift from the cached column.
    * **Vehicle outstanding** is ``SUM(balance_due)`` over the vehicle's
      vouchers — a filtered view of the same voucher rows.
    """

    def __init__(self) -> None:
        self.ledger_repository = LedgerRepository()
        self.voucher_repository = VoucherRepository()

    def customer_outstanding(
        self,
        db: Session,
        customer_id: int,
    ) -> Decimal:
        return self.ledger_repository.outstanding_for_customer(
            db,
            customer_id,
        )

    def customer_outstanding_bulk(
        self,
        db: Session,
        customer_ids: list[int],
    ) -> dict[int, Decimal]:
        return self.ledger_repository.outstanding_for_customers(
            db,
            customer_ids,
        )

    def vehicle_outstanding(
        self,
        db: Session,
        vehicle_id: int,
    ) -> Decimal:
        return self.voucher_repository.outstanding_for_vehicle(
            db,
            vehicle_id,
        )

    def vehicle_outstanding_bulk(
        self,
        db: Session,
        vehicle_ids: list[int],
    ) -> dict[int, Decimal]:
        return self.voucher_repository.outstanding_for_vehicles(
            db,
            vehicle_ids,
        )
