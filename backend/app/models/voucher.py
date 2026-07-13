from __future__ import annotations

from datetime import date
from sqlalchemy import ForeignKey
from decimal import Decimal
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

from sqlalchemy import (
    Date,
    Enum as SqlEnum,
    Float,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import (
    AIProvider,
    FuelType,
    PaymentMode,
    PaymentStatus,
    TallyStatus,
    VerificationStatus,
)
from app.database.base import Base
from app.database.mixins import (
    ActiveMixin,
    IDMixin,
    TimestampMixin,
    UUIDMixin,
)


class Voucher(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    ActiveMixin,
):
    __tablename__ = "vouchers"

    __table_args__ = (
        UniqueConstraint(
            "invoice_number",
            "invoice_date",
            name="uq_invoice_number_date",
        ),
    )

    # ======================================================
    # Invoice Information
    # ======================================================

    invoice_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    invoice_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # ======================================================
    # Customer
    # ======================================================

    vehicle_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )

    customer_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # ======================================================
    # Customer Reference
    # ======================================================

    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"),
        nullable=True,
        index=True,
    )

    customer = relationship(
        "Customer",
        back_populates="vouchers",
    )

    # ======================================================
    # Vehicle Reference
    # ======================================================

    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=True,
        index=True,
    )

    vehicle = relationship(
        "Vehicle",
        back_populates="vouchers",
    )

    settlements = relationship(
        "VoucherSettlement",
        back_populates="voucher",
        cascade="all, delete-orphan",
    )
    # ======================================================
    # Fuel
    # ======================================================

    fuel_type: Mapped[FuelType] = mapped_column(
        SqlEnum(FuelType),
        nullable=False,
    )

    quantity_liters: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    rate_per_liter: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # ======================================================
    # Payment
    # ======================================================

    payment_mode: Mapped[PaymentMode] = mapped_column(
        SqlEnum(PaymentMode),
        nullable=False,
    )

    # How much of total_amount has been settled. Cash/UPI/card sales are
    # fully paid on creation; CREDIT sales accrue payments over time.
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    payment_status: Mapped[PaymentStatus] = mapped_column(
        SqlEnum(PaymentStatus),
        default=PaymentStatus.UNPAID,
        nullable=False,
    )

    # ======================================================
    # AI Information
    # ======================================================

    ai_provider: Mapped[AIProvider | None] = mapped_column(
        SqlEnum(AIProvider),
        nullable=True,
    )

    ocr_confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    image_path: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # ======================================================
    # Status
    # ======================================================

    verification_status: Mapped[VerificationStatus] = mapped_column(
        SqlEnum(VerificationStatus),
        default=VerificationStatus.PENDING,
        nullable=False,
    )

    tally_status: Mapped[TallyStatus] = mapped_column(
        SqlEnum(TallyStatus),
        default=TallyStatus.PENDING,
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    @property
    def balance_due(self) -> Decimal:
        """Amount still owed on this voucher (never negative)."""
        due = (self.total_amount or Decimal("0.00")) - (
            self.amount_paid or Decimal("0.00")
        )
        return due if due > Decimal("0.00") else Decimal("0.00")

