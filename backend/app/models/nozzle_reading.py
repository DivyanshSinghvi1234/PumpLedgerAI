from datetime import date
from decimal import Decimal
from sqlalchemy import Float, ForeignKey, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import (
    IDMixin,
    TimestampMixin,
    UUIDMixin,
    PumpScopedMixin,
)


class NozzleReading(
    Base,
    IDMixin,
    UUIDMixin,
    TimestampMixin,
    PumpScopedMixin,
):
    __tablename__ = "nozzle_readings"

    nozzle_id: Mapped[int] = mapped_column(
        ForeignKey("nozzles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_id: Mapped[int | None] = mapped_column(
        ForeignKey("shifts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reading_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
        index=True,
    )

    opening_reading: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    closing_reading: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    sales: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # Aggregates
    total_sales: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    sales_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    # Relationships
    nozzle: Mapped["Nozzle"] = relationship("Nozzle", back_populates="readings")
    shift: Mapped["Shift"] = relationship("Shift", back_populates="nozzle_readings")
