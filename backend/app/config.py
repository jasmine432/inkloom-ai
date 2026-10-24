from pathlib import Path
from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine directory paths relative to this configuration module
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
BACKEND_ENV_FILE = BACKEND_DIR / ".env"
ROOT_ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """
    Inkloom AI Backend Configuration.
    Secrets and provider configurations are loaded strictly from environment variables or .env.
    """
    model_config = SettingsConfigDict(
        env_file=[ROOT_ENV_FILE, BACKEND_ENV_FILE],
        env_file_encoding="utf-8",
        extra="ignore"
    )

    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # CORS origins permitted to access this backend (supports comma-separated string or list)
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    @field_validator("CORS_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                import json
                return json.loads(v_str)
            return [i.strip() for i in v_str.split(",") if i.strip()]
        return v

    # LLM Provider configuration: "none" (demo/simulation mode), "gemini", or "openai"
    LLM_PROVIDER: str = "none"

    # Server-side API Keys (never exposed to frontend/client)
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Model identifiers and request timeouts
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    OPENAI_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT_SECONDS: float = 45.0

    # Storage and retrieval settings
    SOURCES_DIR: str = str(BACKEND_DIR / "data" / "sources")
    MIN_CITATION_CONFIDENCE: int = 80

    # Firebase Admin Authentication configuration
    # Server-side verification parameters (credentials never exposed to client)
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    REQUIRE_EMAIL_VERIFIED: bool = True
    AUTH_RATE_LIMIT_PER_MINUTE: int = 60
    ALLOW_DEV_SIMULATION_TOKENS: bool = True

    # Evaluation pacing and rate-limit settings (15 RPM safe pacing: 60s / 15 = 4.0s + 0.5s buffer)
    EVALUATION_REQUEST_PACING_SECONDS: float = 4.5
    EVALUATION_MAX_RATE_LIMIT_RETRIES: int = 3
    EVALUATION_BASE_BACKOFF_SECONDS: float = 4.0
    EVALUATION_MAX_BACKOFF_SECONDS: float = 60.0
    EVALUATION_TOTAL_TIME_BUDGET_SECONDS: float = 600.0

    # Database Configuration (Supabase PostgreSQL / Persistent Database)
    # Never exposed to client. Supports PostgreSQL connection strings via psycopg or SQLite fallback.
    DATABASE_URL: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_PROJECT_REF: Optional[str] = None
    EXPECTED_SUPABASE_HOST: Optional[str] = None
    EXPECTED_SUPABASE_DB_NAME: str = "postgres"
    ENFORCE_SSL: bool = True
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False

    @property
    def is_llm_configured(self) -> bool:
        provider = self.LLM_PROVIDER.lower().strip()
        if provider == "gemini" and bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip()):
            return True
        if provider == "openai" and bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY.strip()):
            return True
        return False

    @property
    def is_firebase_configured(self) -> bool:
        if self.FIREBASE_CREDENTIALS_PATH and Path(self.FIREBASE_CREDENTIALS_PATH).exists():
            return True
        if self.FIREBASE_PROJECT_ID and self.FIREBASE_CLIENT_EMAIL and self.FIREBASE_PRIVATE_KEY:
            return True
        if bool(self.FIREBASE_PROJECT_ID and self.FIREBASE_PROJECT_ID.strip()):
            return True
        return False

    @property
    def is_db_configured(self) -> bool:
        return bool(self.DATABASE_URL and self.DATABASE_URL.strip())


settings = Settings()
