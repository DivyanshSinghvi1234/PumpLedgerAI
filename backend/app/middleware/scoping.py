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

        # Initialize context vars for this request. in_request_scope=True arms the
        # fail-closed guard in database/scoping.py: any pump-scoped read without a
        # resolved pump now raises instead of returning cross-pump rows.
        pump_token = active_pump_id.set(None)
        scope_token = in_request_scope.set(True)

        if x_pump_uuid:
            db = SessionLocal()
            try:
                # Resolve the pump UUID → integer id. Pump is NOT pump-scoped, so
                # this read is safe even though the guard is already armed.
                pump = db.scalar(select(Pump).where(Pump.uuid == x_pump_uuid))
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
