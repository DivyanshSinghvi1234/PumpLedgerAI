from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # -------------------------------
    # Application
    # -------------------------------
    APP_NAME: str = "PumpLedger API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI Powered Petrol Pump Management System"
    
    DEBUG: bool = True
    AI_PROVIDER: str = "gemini"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # -------------------------------
    # Server
    # -------------------------------
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # -------------------------------
    # Database
    # -------------------------------
    DATABASE_URL: str = "sqlite:///./pumpledger.db"

    # -------------------------------
    # AI Keys
    # -------------------------------
    GOOGLE_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""

    # -------------------------------
    # Security
    # -------------------------------
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # -------------------------------
# Default Admin
# -------------------------------

    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    DEFAULT_ADMIN_FULL_NAME: str = "Administrator"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()