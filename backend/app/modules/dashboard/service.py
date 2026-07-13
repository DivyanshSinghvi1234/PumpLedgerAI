from sqlalchemy.orm import Session

from app.modules.dashboard.repository import DashboardRepository


class DashboardService:

    def __init__(self):
        self.repository = DashboardRepository()

    def get_dashboard(
        self,
        db: Session,
    ):
        return self.repository.get_summary(db)