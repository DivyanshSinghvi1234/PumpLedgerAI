import contextvars
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria
from app.database.mixins import PumpScopedMixin

# ContextVar to store the active pump's integer ID for the current request context
active_pump_id: contextvars.ContextVar[int | None] = contextvars.ContextVar(
    "active_pump_id", default=None
)

@event.listens_for(Session, "do_orm_execute")
def _do_orm_execute(orm_execute_state):
    """
    Automatically filter all SELECT queries for models inheriting PumpScopedMixin
    to only return records belonging to the active pump context.
    """
    pump_id = active_pump_id.get()
    if pump_id is not None and orm_execute_state.is_select:
        # Inject the query criteria filter for PumpScopedMixin models
        orm_execute_state.statement = orm_execute_state.statement.options(
            with_loader_criteria(
                PumpScopedMixin,
                lambda cls: cls.pump_id == pump_id,
                include_aliases=True,
                propagate_to_loaders=True
            )
        )

@event.listens_for(Session, "before_flush")
def _before_flush(session, flush_context, instances):
    """
    Automatically populate the pump_id field on newly created records
    that inherit from PumpScopedMixin if not already populated.
    """
    pump_id = active_pump_id.get()
    if pump_id is not None:
        for obj in session.new:
            if isinstance(obj, PumpScopedMixin):
                if getattr(obj, "pump_id", None) is None:
                    setattr(obj, "pump_id", pump_id)
