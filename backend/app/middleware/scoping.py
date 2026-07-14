from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.database.scoping import active_pump_id
from app.database.session import SessionLocal
from app.models.pump import Pump
from sqlalchemy import select

class PumpScopingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        x_pump_uuid = request.headers.get("X-Pump-UUID")
        
        # Initialize context var for this request
        token = active_pump_id.set(None)
        
        if x_pump_uuid:
            db = SessionLocal()
            try:
                # Query the database to get the integer primary key id for the pump
                # Note: this query runs before active_pump_id is set, so it won't be filtered out.
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
            # Always reset context var on request exit to prevent leakage
            active_pump_id.reset(token)
