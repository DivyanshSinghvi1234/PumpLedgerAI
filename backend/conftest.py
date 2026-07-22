import os
import tempfile
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Set up test DB before importing app
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.close(_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ["DEBUG"] = "False"
os.environ["GOOGLE_API_KEY"] = "test-key"
os.environ["AI_PROVIDER"] = "GEMINI"

from app.main import app  # noqa: E402
from app.database.init_db import init_db  # noqa: E402
from app.core.dependencies import get_db  # noqa: E402
from app.database.base import Base  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()
    yield
    # Dispose the app engine so it releases its handle to the SQLite file;
    # on Windows an open handle makes os.unlink raise PermissionError.
    from app.database.session import engine

    engine.dispose()
    try:
        os.unlink(_db_path)
    except (PermissionError, FileNotFoundError):
        # Best-effort cleanup: the OS reclaims the temp file eventually.
        pass


@pytest.fixture
def db_session():
    """Create a fresh database session for each test."""
    engine = create_engine(f"sqlite:///{_db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Login as admin and return auth headers."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Get a pump
    pumps_resp = client.get("/api/v1/pumps", headers={"Authorization": f"Bearer {token}"})
    pump_uuid = pumps_resp.json()[0]["uuid"] if pumps_resp.json() else None
    
    headers = {"Authorization": f"Bearer {token}"}
    if pump_uuid:
        headers["X-Pump-UUID"] = pump_uuid
    
    return headers


@pytest.fixture
def customer(client, auth_headers):
    """Create a test customer."""
    response = client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={"name": "Test Customer", "opening_balance": "1000.00"},
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def vehicle(client, auth_headers, customer):
    """Create a test vehicle."""
    response = client.post(
        "/api/v1/vehicles",
        headers=auth_headers,
        json={
            "customer_uuid": customer["uuid"],
            "vehicle_number": "MH12AB1234",
            "vehicle_type": "Truck",
        },
    )
    assert response.status_code == 201
    return response.json()