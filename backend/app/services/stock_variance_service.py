from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.fuel_tank import DipReading, FuelTank, TankerDelivery
from app.models.nozzle import Nozzle
from app.models.nozzle_reading import NozzleReading
from app.models.stock_variance import StockVariance
from app.schemas.stock_variance import (
    StockAlert,
    StockVarianceDailySummaryResponse,
    StockVarianceResponse,
)
from app.services.audit_log_service import AuditLogService
from app.services.price_schedule_service import PriceScheduleService
from app.services.pump_setting_service import PumpSettingService


class StockVarianceService:
    """Computes daily book stock vs physical dip variances per fuel tank
    and detects persistent leak/theft trends."""

    SETTING_KEY = "variance_threshold_percent"
    DEFAULT_THRESHOLD_PERCENT = 0.5

    def __init__(self) -> None:
        self.setting_service = PumpSettingService()
        self.price_service = PriceScheduleService()
        self.audit_service = AuditLogService()

    def get_threshold_percent(self, db: Session) -> float:
        raw = self.setting_service.get_setting(db, self.SETTING_KEY)
        if raw is None:
            return self.DEFAULT_THRESHOLD_PERCENT
        if isinstance(raw, dict):
            val = raw.get("threshold", self.DEFAULT_THRESHOLD_PERCENT)
        else:
            val = raw
        try:
            parsed = float(val)
            return parsed if parsed > 0 else self.DEFAULT_THRESHOLD_PERCENT
        except (TypeError, ValueError):
            return self.DEFAULT_THRESHOLD_PERCENT

    @staticmethod
    def _classify_status(variance_percent: float | None, threshold: float) -> str:
        if variance_percent is None:
            return "PENDING_DIP"
        abs_pct = abs(variance_percent)
        if abs_pct <= threshold:
            return "OK"
        if abs_pct <= threshold * 2.0:
            return "WARNING"
        return "CRITICAL"

    def _resolve_opening_stock(
        self,
        db: Session,
        tank: FuelTank,
        target_date: date,
        deliveries_today: float,
        drawdown_today: float,
        existing_row: StockVariance | None = None,
    ) -> float:
        prev_var = db.scalar(
            select(StockVariance)
            .where(
                StockVariance.tank_id == tank.id,
                StockVariance.variance_date < target_date,
            )
            .order_by(StockVariance.variance_date.desc(), StockVariance.id.desc())
            .limit(1)
        )
        if prev_var is not None:
            return float(
                prev_var.physical_dip
                if prev_var.physical_dip is not None
                else prev_var.book_stock
            )

        prev_dip = db.scalar(
            select(DipReading)
            .where(
                DipReading.tank_id == tank.id,
                DipReading.reading_date < target_date,
                DipReading.is_active.is_(True),
            )
            .order_by(DipReading.reading_date.desc(), DipReading.id.desc())
            .limit(1)
        )
        if prev_dip is not None:
            return float(prev_dip.closing_dip_liters)

        # Preserve initial day's opening_stock once computed so updating physical_dip
        # (which syncs tank.current_stock_liters) does not overwrite opening_stock.
        if existing_row is not None:
            return float(existing_row.opening_stock)

        # Fallback: derive opening from live virtual stock before today's movements
        return round(float(tank.current_stock_liters) - deliveries_today + drawdown_today, 3)

    def compute_daily_variance(
        self,
        db: Session,
        target_date: date,
        physical_dips: dict[str, float] | None = None,
        actor_id: int | None = None,
    ) -> list[StockVariance]:
        tanks = list(
            db.scalars(
                select(FuelTank)
                .where(FuelTank.is_active.is_(True))
                .order_by(FuelTank.name.asc())
            ).all()
        )
        threshold = self.get_threshold_percent(db)
        results: list[StockVariance] = []

        for tank in tanks:
            deliveries = float(
                db.scalar(
                    select(func.coalesce(func.sum(TankerDelivery.quantity_liters), 0.0)).where(
                        TankerDelivery.tank_id == tank.id,
                        TankerDelivery.delivery_date == target_date,
                        TankerDelivery.is_active.is_(True),
                    )
                )
                or 0.0
            )

            readings = list(
                db.scalars(
                    select(NozzleReading)
                    .join(Nozzle, NozzleReading.nozzle_id == Nozzle.id)
                    .where(
                        Nozzle.tank_id == tank.id,
                        NozzleReading.reading_date == target_date,
                    )
                ).all()
            )
            meter_sales = round(sum(float(r.sales or 0.0) for r in readings), 3)
            testing_qty = round(sum(float(r.testing_liters or 0.0) for r in readings), 3)
            unreturned_testing = round(
                sum(
                    float(r.testing_liters or 0.0)
                    for r in readings
                    if not getattr(r, "return_testing_to_storage", True)
                ),
                3,
            )
            drawdown_today = meter_sales + unreturned_testing

            existing = db.scalar(
                select(StockVariance).where(
                    StockVariance.tank_id == tank.id,
                    StockVariance.variance_date == target_date,
                )
            )

            opening_stock = self._resolve_opening_stock(
                db, tank, target_date, deliveries, drawdown_today, existing_row=existing
            )
            book_stock = round(opening_stock + deliveries - drawdown_today, 3)

            explicit_dip = None
            if physical_dips and str(tank.uuid) in physical_dips:
                explicit_dip = float(physical_dips[str(tank.uuid)])

            physical_dip: float | None = explicit_dip
            if physical_dip is None and existing is not None:
                physical_dip = existing.physical_dip
            if physical_dip is None:
                dip_today = db.scalar(
                    select(DipReading)
                    .where(
                        DipReading.tank_id == tank.id,
                        DipReading.reading_date == target_date,
                        DipReading.is_active.is_(True),
                    )
                    .order_by(DipReading.id.desc())
                    .limit(1)
                )
                if dip_today is not None:
                    physical_dip = float(dip_today.closing_dip_liters)

            variance_liters: float | None = None
            variance_percent: float | None = None
            if physical_dip is not None:
                variance_liters = round(physical_dip - book_stock, 3)
                denom = book_stock if book_stock > 0 else max(tank.capacity_liters, 1.0)
                variance_percent = round((variance_liters / denom) * 100.0, 2)
                if explicit_dip is not None:
                    tank.current_stock_liters = physical_dip
                    db.add(tank)

            status = self._classify_status(variance_percent, threshold)

            if existing is not None:
                existing.opening_stock = opening_stock
                existing.deliveries_received = deliveries
                existing.meter_sales = meter_sales
                existing.testing_qty = testing_qty
                existing.book_stock = book_stock
                existing.physical_dip = physical_dip
                existing.variance_liters = variance_liters
                existing.variance_percent = variance_percent
                existing.status = status
                existing.threshold_percent = threshold
                row = existing
            else:
                row = StockVariance(
                    tank_id=tank.id,
                    variance_date=target_date,
                    opening_stock=opening_stock,
                    deliveries_received=deliveries,
                    meter_sales=meter_sales,
                    testing_qty=testing_qty,
                    book_stock=book_stock,
                    physical_dip=physical_dip,
                    variance_liters=variance_liters,
                    variance_percent=variance_percent,
                    status=status,
                    threshold_percent=threshold,
                    pump_id=tank.pump_id,
                )
                db.add(row)

            results.append(row)

        db.commit()
        for row in results:
            db.refresh(row)

        if physical_dips and results:
            self.audit_service.log_action(
                db,
                action="Recorded Stock Dip Reconciliation",
                target_table="stock_variances",
                target_id=str(results[0].id),
                actor_id=actor_id,
                new_values={
                    "variance_date": target_date.isoformat(),
                    "tank_count": len(results),
                },
            )

        return results

    def _to_response(self, db: Session, row: StockVariance, tank: FuelTank, at_time: datetime) -> StockVarianceResponse:
        rate = self.price_service.get_active_rate(db, tank.fuel_type, at_time)
        var_amt = (
            round(float(row.variance_liters) * float(rate), 2)
            if (row.variance_liters is not None and rate is not None)
            else None
        )
        return StockVarianceResponse(
            uuid=str(row.uuid),
            tank_uuid=str(tank.uuid),
            tank_name=tank.name,
            fuel_type=tank.fuel_type,
            capacity_liters=float(tank.capacity_liters),
            variance_date=row.variance_date,
            opening_stock=float(row.opening_stock),
            deliveries_received=float(row.deliveries_received),
            meter_sales=float(row.meter_sales),
            testing_qty=float(row.testing_qty),
            book_stock=float(row.book_stock),
            physical_dip=row.physical_dip,
            variance_liters=row.variance_liters,
            variance_percent=row.variance_percent,
            variance_amount=var_amt,
            status=row.status,
            threshold_percent=float(row.threshold_percent),
        )

    def check_alerts(self, db: Session, target_date: date) -> list[StockAlert]:
        tanks = list(
            db.scalars(
                select(FuelTank)
                .where(FuelTank.is_active.is_(True))
                .order_by(FuelTank.name.asc())
            ).all()
        )
        alerts: list[StockAlert] = []
        lookback_start = target_date - timedelta(days=14)

        for tank in tanks:
            history = list(
                db.scalars(
                    select(StockVariance)
                    .where(
                        StockVariance.tank_id == tank.id,
                        StockVariance.variance_date >= lookback_start,
                        StockVariance.variance_date <= target_date,
                        StockVariance.status != "PENDING_DIP",
                    )
                    .order_by(StockVariance.variance_date.desc())
                ).all()
            )
            if not history:
                continue

            consecutive = 0
            for item in history:
                if item.status == "CRITICAL":
                    consecutive += 1
                else:
                    break

            latest = history[0]
            if consecutive >= 3:
                alerts.append(
                    StockAlert(
                        tank_uuid=str(tank.uuid),
                        tank_name=tank.name,
                        fuel_type=tank.fuel_type,
                        consecutive_critical_days=consecutive,
                        latest_variance_liters=float(latest.variance_liters or 0.0),
                        latest_variance_percent=float(latest.variance_percent or 0.0),
                        message=(
                            f"{tank.name} has exceeded variance threshold for {consecutive} "
                            f"consecutive days (latest: {latest.variance_liters:+.1f} L)."
                        ),
                    )
                )
        return alerts

    def get_daily_summary(self, db: Session, target_date: date) -> StockVarianceDailySummaryResponse:
        rows = self.compute_daily_variance(db, target_date)
        threshold = self.get_threshold_percent(db)
        at_time = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc)
        tanks_by_id = {
            t.id: t
            for t in db.scalars(select(FuelTank).where(FuelTank.is_active.is_(True))).all()
        }
        items = [
            self._to_response(db, r, tanks_by_id[r.tank_id], at_time)
            for r in rows
            if r.tank_id in tanks_by_id
        ]
        alerts = self.check_alerts(db, target_date)
        return StockVarianceDailySummaryResponse(
            variance_date=target_date,
            threshold_percent=threshold,
            items=items,
            alerts=alerts,
        )

    def get_trend(self, db: Session, tank_uuid: str, days: int = 14) -> list[StockVarianceResponse]:
        tank = db.scalar(select(FuelTank).where(FuelTank.uuid == tank_uuid))
        if not tank:
            raise ValueError(f"Fuel tank '{tank_uuid}' not found.")

        since = date.today() - timedelta(days=days - 1)
        rows = list(
            db.scalars(
                select(StockVariance)
                .where(
                    StockVariance.tank_id == tank.id,
                    StockVariance.variance_date >= since,
                )
                .order_by(StockVariance.variance_date.asc())
            ).all()
        )
        result = []
        for r in rows:
            at_time = datetime(
                r.variance_date.year,
                r.variance_date.month,
                r.variance_date.day,
                23,
                59,
                59,
                tzinfo=timezone.utc,
            )
            result.append(self._to_response(db, r, tank, at_time))
        return result
