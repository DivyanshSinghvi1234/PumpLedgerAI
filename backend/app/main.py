# Reload trigger: 2026-07-22 10:04
from fastapi import Depends, FastAPI
from fastapi.responses import ORJSONResponse

from fastapi.middleware.cors import CORSMiddleware
from app.models import Voucher
from app.api.v1.routes.voucher import router as voucher_router
from app.api.v1.routes.upload import router as upload_router
from fastapi.staticfiles import StaticFiles
from app.api.v1.routes.vision import router as vision_router
from app.api.v1.routes.vehicle import router as vehicle_router
from app.api.v1.routes.auth import (
    router as auth_router,
)
from app.modules.dashboard.router import (
    router as dashboard_router,
)

from app.core.config import settings
import os
from app.core.dependencies import get_current_user, require_roles
from app.core.enums import UserRole
from app.core.logging import get_logger, setup_logging
from app.database.init_db import init_db
from app.api.v1.routes.customer import router as customer_router
from app.api.v1.routes.user import router as user_router
from app.api.v1.routes.payment import router as payment_router
from app.api.v1.routes.ledger import router as ledger_router
from app.api.v1.routes.report import router as report_router
from app.api.v1.routes.tally import router as tally_router
from app.api.v1.routes.fuel_tank import router as fuel_tank_router
from app.api.v1.routes.nozzle import router as nozzle_router
from app.api.v1.routes.price_schedule import router as price_schedule_router
from app.api.v1.routes.shift import router as shift_router
from app.api.v1.routes.audit_log import router as audit_log_router
from app.api.v1.routes.employee import router as employee_router
from app.api.v1.routes.pump import router as pump_router
from app.api.v1.routes.income import router as income_router
from app.api.v1.routes.aging import router as aging_router
from app.api.v1.routes.forecast import router as forecast_router
from app.api.v1.routes.margins import router as margins_router
from app.api.v1.routes.churn import router as churn_router
from app.api.v1.routes.nps import router as nps_router

# Configure logging
setup_logging()
logger = get_logger(__name__)

# Routers below this dependency require a valid bearer token.
protected = [Depends(get_current_user)]

# Manager+ routes: require ADMIN or MANAGER role (blocks OPERATOR/Employee).
manager_protected = [
    Depends(get_current_user),
    Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
]

from app.middleware.scoping import PumpScopingMiddleware

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    default_response_class=ORJSONResponse,
)

# Register pump scoping middleware
app.add_middleware(PumpScopingMiddleware)


from app.core.exceptions import AppException
from fastapi import Request

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    status_code = 400
    name = exc.__class__.__name__
    if "NotFoundError" in name:
        status_code = 404
    elif "Duplicate" in name:
        status_code = 409
    return ORJSONResponse(
        status_code=status_code,
        content={"detail": str(exc)},
    )

# CORS: reads ALLOWED_ORIGINS env-var (comma-separated) so Render frontend URL
# can be injected at runtime without code changes.  Falls back to localhost dev URLs.
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "http://localhost:5177",
    "http://127.0.0.1:5177",
    "http://localhost:5178",
    "http://127.0.0.1:5178",
    "http://localhost:5179",
    "http://127.0.0.1:5179",
    "https://pumpledger-frontend.onrender.com",
    "https://pumpledger-backend.onrender.com",
]
_extra = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins = (
    [o.strip() for o in _extra.split(",") if o.strip()] + _default_origins
    if _extra
    else _default_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: http: https:; "
        "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 http://localhost:5173 http://127.0.0.1:5173;"
    )
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(
    voucher_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    upload_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    vision_router,
    prefix="/api/v1",
    dependencies=protected,
)

app.include_router(
    customer_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    vehicle_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    auth_router,
    prefix="/api/v1",
)
app.include_router(
    user_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    dashboard_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    payment_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    ledger_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    report_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    tally_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    fuel_tank_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    nozzle_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    price_schedule_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    shift_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    audit_log_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    employee_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    pump_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    income_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    aging_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    forecast_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    margins_router,
    prefix="/api/v1",
    dependencies=manager_protected,
)
app.include_router(
    churn_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    nps_router,
    prefix="/api/v1",
)
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
storage_dir = os.path.join(BASE_DIR, "storage")
os.makedirs(storage_dir, exist_ok=True)

app.mount(
    "/storage",
    StaticFiles(directory=storage_dir),
    name="storage",
)


@app.on_event("startup")
async def startup():
    logger.info("Starting PumpLedger API...")

    from app.core.config import settings
    with open("backend_db_url.log", "w") as f:
        f.write(f"DATABASE_URL={settings.DATABASE_URL}\n")

    init_db()

    logger.info("Database initialized")


@app.get("/", tags=["Root"])
async def root():
    logger.info("Root endpoint called")

    return {
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": settings.DATABASE_URL,
        "debug": settings.DEBUG,
    }


@app.get("/health", tags=["Health"])
async def health():
    logger.info("Health endpoint checked")

    return {
        "status": "healthy"
    }