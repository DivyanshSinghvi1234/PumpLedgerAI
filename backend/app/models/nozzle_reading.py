from datetime import date, time as time_type
from decimal import Decimal
from sqlalchemy import Float, ForeignKey, Numeric, Date, Time, Boolean
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

    # Reading timestamps — default 19:30 (typical shift end time)
    opening_time: Mapped[time_type | None] = mapped_column(
        Time,
        nullable=True,
        default=time_type(19, 30),
    )
    closing_time: Mapped[time_type | None] = mapped_column(
        Time,
        nullable=True,
        default=time_type(19, 30),
    )

    opening_reading: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    closing_reading: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # Optional 6:00 AM interim reading — present only on price-change days
    # When set: sales_before_6am = interim_6am_reading - opening_reading
    #            sales_after_6am = closing_reading - interim_6am_reading
    interim_6am_reading: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    sales: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    testing_liters: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    return_testing_to_storage: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
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

