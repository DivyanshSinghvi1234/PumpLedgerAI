from fastapi import Depends, FastAPI
from fastapi.responses import ORJSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.models import Voucher
from app.api.v1.routes.voucher import router as voucher_router
from app.api.v1.routes.upload import router as upload_router
from fastapi.staticfiles import StaticFiles
from app.api.v1.routes.vision import router as vision_router
from app.api.v1.routes.test_vision import router as test_vision_router
from app.api.v1.routes.vehicle import router as vehicle_router
from app.api.v1.routes.auth import (
    router as auth_router,
)
from app.modules.dashboard.router import (
    router as dashboard_router,
)

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.logging import get_logger, setup_logging
from app.database.init_db import init_db
from app.api.v1.routes.customer import router as customer_router
from app.api.v1.routes.user import router as user_router
from app.api.v1.routes.payment import router as payment_router
from app.api.v1.routes.ledger import router as ledger_router
from app.api.v1.routes.report import router as report_router
from app.api.v1.routes.tally import router as tally_router

# Configure logging
setup_logging()
logger = get_logger(__name__)

# Routers below this dependency require a valid bearer token.
protected = [Depends(get_current_user)]

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    default_response_class=ORJSONResponse,
)

# Allow the Vite dev frontend to call the API during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    test_vision_router,
    prefix="/api/v1",
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
    dependencies=protected,
)
app.include_router(
    ledger_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    report_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.include_router(
    tally_router,
    prefix="/api/v1",
    dependencies=protected,
)
app.mount(
    "/storage",
    StaticFiles(directory="storage"),
    name="storage",
)


@app.on_event("startup")
async def startup():
    logger.info("Starting PumpLedger API...")

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