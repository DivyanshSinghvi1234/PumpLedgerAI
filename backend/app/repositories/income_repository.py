from __future__ import annotations

from datetime import date
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import IncomeKind
from app.models.income import Income
from app.repositories.base_repository import BaseRepository


class IncomeRepository(BaseRepository[Income]):

    def __init__(self) -> None:
        super().__init__(Income)

    def get_by_uuid(
        self,
        db: Session,
        income_uuid: str,
    ) -> Income | None:
        # Eager-load the optional customer so the response can flatten it.
        return db.scalar(
            select(Income)
            .where(Income.uuid == income_uuid)
            .options(joinedload(Income.customer))
        )

    def search(
        self,
        db: Session,
        *,
        income_date: date | None = None,
        kind: IncomeKind | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Income], int]:

        query = (
            select(Income)
            .where(Income.is_active.is_(True))
        )

        if income_date:
            query = query.where(Income.income_date == income_date)

        if kind:
            query = query.where(Income.kind == kind)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Income.description.ilike(pattern),
                    Income.category.ilike(pattern),
                )
            )

        total = db.scalar(
            select(func.count()).select_from(query.subquery())
        )

        query = query.options(joinedload(Income.customer))

        query = (
            query
            .order_by(Income.income_date.desc(), Income.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        return list(db.scalars(query).all()), total or 0

    def totals_for_date(
        self, db: Session, income_date: date
    ) -> dict[IncomeKind, float]:
        """Sum of active amounts on a date, grouped by kind (INCOME/EXPENSE)."""
        rows = db.execute(
            select(
                Income.kind,
                func.coalesce(func.sum(Income.amount), 0),
            )
            .where(
                Income.is_active.is_(True),
                Income.income_date == income_date,
            )
            .group_by(Income.kind)
        ).all()
        result: dict = {}
        for kind, total in rows:
            if kind is None:
                continue
            result[kind] = total
            if hasattr(kind, "value"):
                result[kind.value] = total
            else:
                try:
                    result[IncomeKind(kind)] = total
                except Exception:
                    pass
        return result

    def distinct_categories(self, db: Session) -> list[str]:
        """Previously-used category names, for the frontend autocomplete."""
        rows = db.scalars(
            select(Income.category)
            .where(
                Income.is_active.is_(True),
                Income.category.is_not(None),
            )
            .distinct()
            .order_by(Income.category)
        ).all()
        return [c for c in rows if c]
