from pydantic_settings import BaseSettings
from typing import Literal, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Billing Request OS"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database Provider: "postgres" or "supabase"
    DATABASE_PROVIDER: Literal["postgres", "supabase"] = "postgres"

    # PostgreSQL settings
    DATABASE_URL: str = ""

    # Supabase settings
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Slack Integration
    SLACK_BOT_TOKEN: str = ""
    SLACK_SIGNING_SECRET: str = ""
    SLACK_CHANNEL_ID: str = ""
    SLACK_ENABLED: bool = True

    # Resend Email Integration
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@example.com"
    EMAIL_ENABLED: bool = True

    # Client Portal
    PORTAL_BASE_URL: str = "http://localhost:5173/portal"
    PORTAL_TOKEN_EXPIRY_HOURS: int = 72

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # SLA Configuration (in minutes)
    SLA_UNCLAIMED_THRESHOLD: int = 15  # 15 minutes
    SLA_NOT_SENT_THRESHOLD: int = 240  # 4 hours
    SLA_CLIENT_RESPONSE_WARNING: int = 4320  # 3 days
    SLA_CLIENT_RESPONSE_BREACH: int = 10080  # 7 days

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
