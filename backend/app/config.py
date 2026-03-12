from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load root .env first, then backend/.env for optional backend-specific overrides.
backend_dir = Path(__file__).parent.parent
project_root = backend_dir.parent
load_dotenv(project_root / ".env")
load_dotenv(backend_dir / ".env", override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/factguard_db"
    FRONTEND_URL: str = "http://localhost:5173"
    SERPER_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "FactGuard"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SESSION_TTL_SECONDS: int = 60 * 60 * 8
    SIGNUP_OTP_TTL_SECONDS: int = 10 * 60
    PASSWORD_RESET_TTL_SECONDS: int = 30 * 60
    ADMIN_EMAIL: str = "admin@factguard.com"
    ADMIN_PASSWORD: str = "@Password04"
    ADMIN_USERNAME: str = "FactGuard Admin"


settings = Settings()
