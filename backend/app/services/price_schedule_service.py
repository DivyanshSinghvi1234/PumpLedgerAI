from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.price_schedule import PriceSchedule
from app.repositories.price_schedule_repository import PriceScheduleRepository
from app.core.enums import FuelType
from app.core.exceptions import PriceScheduleNotFoundError


class PriceScheduleService:

    def __init__(self):
        self.repository = PriceScheduleRepository()

    def create_schedule(
        self,
        db: Session,
        fuel_type: FuelType,
        rate: Decimal | float,
        effective_from: datetime,
    ) -> PriceSchedule:
        schedule = PriceSchedule(
            fuel_type=fuel_type,
            rate=Decimal(str(rate)),
            effective_from=effective_from,
            is_applied=False,
        )
        return self.repository.create(db, schedule)

    def get_active_rate(
        self,
        db: Session,
        fuel_type: FuelType,
        at_time: datetime | None = None,
    ) -> Decimal | None:
        """Get the active fuel rate at a specific timestamp (defaults to now)."""
        time_to_check = at_time or datetime.now(timezone.utc)
        schedule = self.repository.get_active_rate(db, fuel_type, time_to_check)
        return schedule.rate if schedule else None

    def apply_pending_schedules(self, db: Session) -> int:
        """Find and mark all schedules whose effective_from time has passed as applied."""
        now = datetime.now(timezone.utc)
        schedules = self.repository.get_unapplied_schedules(db, now)
        count = 0
        for s in schedules:
            s.is_applied = True
            self.repository.update(db, s)
            count += 1
        return count

    def fetch_live_rajasthan_rates(self) -> dict[str, float]:
        """
        Scrapes current fuel prices for Rajasthan from GoodReturns with a fallback default.
        """
        import httpx
        import re

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        }
        
        rates = {
            "PETROL": 112.66,
            "DIESEL": 97.78,
            "SPEED": 116.96,  # Petrol + 4.30 premium
            "live": False
        }
        
        try:
            # 1. Fetch Petrol
            petrol_url = "https://www.goodreturns.in/petrol-price-in-rajasthan.html"
            r_petrol = httpx.get(petrol_url, headers=headers, timeout=5.0, follow_redirects=True)
            if r_petrol.status_code == 200:
                match = re.search(r"/petrol-price-in-jaipur\.html.*?&#x20b9;\s*(\d+\.\d+)", r_petrol.text, re.DOTALL | re.IGNORECASE)
                if match:
                    rates["PETROL"] = float(match.group(1))
                    rates["live"] = True
                    
            # 2. Fetch Diesel
            diesel_url = "https://www.goodreturns.in/diesel-price-in-rajasthan.html"
            r_diesel = httpx.get(diesel_url, headers=headers, timeout=5.0, follow_redirects=True)
            if r_diesel.status_code == 200:
                match = re.search(r"/diesel-price-in-jaipur\.html.*?&#x20b9;\s*(\d+\.\d+)", r_diesel.text, re.DOTALL | re.IGNORECASE)
                if match:
                    rates["DIESEL"] = float(match.group(1))
                    rates["live"] = True
        except Exception:
            # Fallback will be used, rates["live"] remains False
            pass
            
        # Dynamically set SPEED based on PETROL rate (+ 4.30 premium)
        rates["SPEED"] = round(rates["PETROL"] + 4.30, 2)
        
        return rates

    def sync_rajasthan_prices(self, db: Session) -> dict[str, float]:
        """
        Fetches Rajasthan fuel prices, creates and immediately applies new price schedules.
        """
        rates = self.fetch_live_rajasthan_rates()
        now = datetime.now(timezone.utc)
        
        # Create schedules for core fuel types
        self.create_schedule(db, FuelType.PETROL, rates["PETROL"], now)
        self.create_schedule(db, FuelType.SPEED, rates["SPEED"], now)
        self.create_schedule(db, FuelType.DIESEL, rates["DIESEL"], now)
        
        # Apply them immediately
        self.apply_pending_schedules(db)
        
        return {
            "PETROL": rates["PETROL"],
            "SPEED": rates["SPEED"],
            "DIESEL": rates["DIESEL"],
            "live": rates["live"]
        }

    def get_all_schedules(self, db: Session) -> list[PriceSchedule]:
        """
        Get all active price schedules ordered by effective_from descending.
        """
        return self.repository.get_all_schedules(db)

    def delete_schedule(self, db: Session, schedule_uuid: str) -> None:
        """
        Delete a price schedule by UUID.
        """
        schedule = self.repository.get_by_uuid(db, schedule_uuid)
        if schedule is None:
            raise PriceScheduleNotFoundError(schedule_uuid)
        self.repository.delete(db, schedule)

