from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.database.scoping import active_pump_id, in_request_scope
from app.database.session import SessionLocal
from app.models.pump import Pump
from sqlalchemy import select

class PumpScopingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        x_pump_uuid = request.headers.get("X-Pump-UUID")

        # Exempt public NPS rating submissions from request scope fail-closed guard
        # as anonymous customers do not carry a pump header.
        is_public_rate = request.url.path.startswith("/api/v1/nps/rate/")

        # Initialize context vars for this request. in_request_scope=True arms the
        # fail-closed guard in database/scoping.py: any pump-scoped read without a
        # resolved pump now raises instead of returning cross-pump rows.
        pump_token = active_pump_id.set(None)
        scope_token = in_request_scope.set(not is_public_rate)

        db = SessionLocal()
        try:
            pump = None
            if x_pump_uuid:
                pump = db.scalar(select(Pump).where(Pump.uuid == x_pump_uuid))
            if not pump:
                pump = db.scalar(select(Pump).where(Pump.is_active.is_(True)).order_by(Pump.id))
            if not pump:
                pump = db.scalar(select(Pump).order_by(Pump.id))

            if pump:
                active_pump_id.set(pump.id)
        except Exception:
            pass
        finally:
            db.close()


        try:
            response = await call_next(request)
            return response
        finally:
            # Always reset context vars on request exit to prevent leakage
            active_pump_id.reset(pump_token)
            in_request_scope.reset(scope_token)
