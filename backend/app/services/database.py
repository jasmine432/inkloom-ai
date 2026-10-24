import logging
import re
from pathlib import Path
from typing import Generator, Optional
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker
from backend.app.config import settings, BACKEND_DIR
from backend.app.models.db_models import Base

logger = logging.getLogger("inkloom_db")

_engine: Optional[Engine] = None
_SessionFactory: Optional[sessionmaker] = None
_current_engine_url: Optional[str] = None
_last_db_error: Optional[str] = None


def sanitize_db_url_or_error(message: str) -> str:
    """
    Strips passwords and sensitive credentials from database connection strings or error messages.
    """
    return re.sub(r':([^@/\s]+)@', ':***@', message)


def validate_database_target(parsed_url, live_db_name: Optional[str] = None) -> None:
    """
    Validates database targets against strict tenancy and isolation safeguards.
    - Unconditionally rejects 'polar_logistics' in all environments.
    - Local connections (localhost, 127.0.0.1, host.docker.internal, empty) must strictly target 'inkloom_ai'.
    - Remote connections require an explicitly configured EXPECTED_SUPABASE_HOST (no suffix fallbacks).
    - Remote connections must match EXPECTED_SUPABASE_HOST, EXPECTED_SUPABASE_DB_NAME, and TLS (sslmode).
    - If SUPABASE_PROJECT_REF is set, connection credentials/host must reflect that project reference.
    """
    backend_name = parsed_url.get_backend_name() if hasattr(parsed_url, "get_backend_name") else ""
    if backend_name and backend_name != "postgresql":
        return

    target_db = (getattr(parsed_url, "database", "") or "").strip().lower()
    actual_db = (live_db_name or target_db).strip().lower()
    host = (getattr(parsed_url, "host", "") or "").strip().lower()
    username = (getattr(parsed_url, "username", "") or "").strip()
    query_params = getattr(parsed_url, "query", {})

    # 1. Unconditional check: polar_logistics is strictly forbidden under all circumstances
    if target_db == "polar_logistics" or actual_db == "polar_logistics":
        raise ValueError(
            "Database isolation violation: Inkloom AI cannot connect to 'polar_logistics'. "
            "Execution terminated unconditionally."
        )

    # 2. Local connections: must strictly target 'inkloom_ai'
    is_local_host = host in ("", "localhost", "127.0.0.1", "host.docker.internal")
    if is_local_host:
        if actual_db != "inkloom_ai":
            raise ValueError(
                f"Database isolation violation: Local PostgreSQL connections must target 'inkloom_ai' strictly. "
                f"(Attempted: '{actual_db}' on host '{host}')."
            )
        return

    # 3. Remote connections: require explicitly configured exact hostname (no wildcard/suffix fallback)
    if not settings.EXPECTED_SUPABASE_HOST or not settings.EXPECTED_SUPABASE_HOST.strip():
        raise ValueError(
            "Database security violation: Remote database connections require an explicitly "
            "configured EXPECTED_SUPABASE_HOST. Generic suffix fallbacks are not permitted."
        )

    expected_host = settings.EXPECTED_SUPABASE_HOST.strip().lower()
    if host != expected_host:
        raise ValueError(
            f"Database isolation violation: Remote host '{host}' does not match explicitly "
            f"configured EXPECTED_SUPABASE_HOST '{expected_host}'."
        )

    # Validate expected remote database name (defaults to 'postgres')
    expected_db = (settings.EXPECTED_SUPABASE_DB_NAME or "postgres").strip().lower()
    if actual_db != expected_db:
        raise ValueError(
            f"Database isolation violation: Remote database '{actual_db}' does not match "
            f"EXPECTED_SUPABASE_DB_NAME '{expected_db}'."
        )

    # Validate Supabase project reference if configured
    if settings.SUPABASE_PROJECT_REF and settings.SUPABASE_PROJECT_REF.strip():
        project_ref = settings.SUPABASE_PROJECT_REF.strip().lower()
        has_ref_in_user = project_ref in username.lower()
        has_ref_in_host = project_ref in host
        if not (has_ref_in_user or has_ref_in_host):
            raise ValueError(
                f"Database isolation violation: Connection credentials do not match "
                f"SUPABASE_PROJECT_REF '{settings.SUPABASE_PROJECT_REF}'."
            )

    # Validate TLS enforcement on remote connections
    if settings.ENFORCE_SSL:
        sslmode = str(query_params.get("sslmode", "")).strip().lower()
        if sslmode not in ("require", "verify-ca", "verify-full"):
            raise ValueError(
                "Database security violation: Remote database connections must enforce TLS "
                "(sslmode=require, verify-ca, or verify-full)."
            )


def get_normalized_database_url() -> str:
    """
    Returns the normalized database connection URL.
    Validates isolation and security constraints before returning.
    Supports PostgreSQL (via psycopg) strictly for validated targets,
    with graceful fallback to local SQLite when PostgreSQL is unconfigured.
    """
    db_url = settings.DATABASE_URL
    if db_url and db_url.strip():
        url = db_url.strip()
        # SQLAlchemy 2.0 requires postgresql:// instead of legacy postgres://
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        # Ensure psycopg driver is used if generic postgresql:// is provided
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]

        parsed = make_url(url)
        if parsed.get_backend_name() == "postgresql":
            validate_database_target(parsed)
        return url

    # Default fallback for local development or testing when PostgreSQL is intentionally unconfigured
    local_db_path = BACKEND_DIR / "data" / "inkloom.db"
    local_db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{local_db_path}"


def reset_engine() -> None:
    """
    Disposes active engine connection pool and resets engine singleton.
    Prevents stale connection pools from persisting across configuration reloads.
    """
    global _engine, _SessionFactory, _current_engine_url, _last_db_error
    if _engine is not None:
        try:
            _engine.dispose()
        except Exception as e:
            logger.debug("Engine disposal notice: %s", e)
        _engine = None
    _SessionFactory = None
    _current_engine_url = None
    _last_db_error = None


def get_engine() -> Engine:
    """
    Returns or creates the singleton SQLAlchemy engine.
    Ensures that if the configuration or URL changes, stale engines are cleanly disposed.
    """
    global _engine, _current_engine_url
    url = get_normalized_database_url()

    if _engine is not None:
        if _current_engine_url == url:
            return _engine
        logger.info("Database URL change detected; disposing previous engine.")
        reset_engine()

    parsed = make_url(url)
    is_sqlite = url.startswith("sqlite")

    connect_args = {}
    if is_sqlite:
        connect_args["check_same_thread"] = False
        _engine = create_engine(
            url,
            connect_args=connect_args,
            echo=settings.DB_ECHO,
        )

        # Enforce foreign key constraints in SQLite identical to PostgreSQL
        @event.listens_for(_engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    else:
        # If targeting a transaction pooler (port 6543), disable Psycopg 3 prepared statements
        if parsed.port == 6543:
            connect_args["prepare_threshold"] = None

        _engine = create_engine(
            url,
            connect_args=connect_args,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=settings.DB_ECHO,
        )

    _current_engine_url = url
    masked_url = sanitize_db_url_or_error(url)
    logger.info("Database engine initialized for %s (%s).", 'SQLite' if is_sqlite else 'PostgreSQL', masked_url)
    return _engine


def get_session_factory() -> sessionmaker:
    global _SessionFactory
    if _SessionFactory is None:
        engine = get_engine()
        _SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionFactory


def init_db(engine: Optional[Engine] = None) -> None:
    """
    Initializes and verifies database schema.
    Enforces runtime wire-level guard ensuring the active database is validated.
    In production mode, verifies table existence and prevents Base.metadata.create_all()
    from bypassing canonical SQL migrations.
    """
    target_engine = engine or get_engine()
    if target_engine.dialect.name == "postgresql":
        with target_engine.connect() as conn:
            actual_db = conn.execute(text("SELECT current_database()")).scalar()
            validate_database_target(target_engine.url, live_db_name=actual_db)

    # In production, require schema initialization via migrations rather than runtime DDL
    if settings.ENVIRONMENT.lower() == "production":
        with target_engine.connect() as conn:
            table_check = conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'")
            ).scalar()
            if not table_check:
                raise RuntimeError(
                    "Production database schema uninitialized: table 'profiles' not found. "
                    "Run canonical SQL migrations (001_initial_schema.sql, 002_chat_schema.sql) before starting."
                )
        logger.info("Production database schema verified (runtime DDL bypass prevented).")
    else:
        Base.metadata.create_all(bind=target_engine)
        logger.info("Database schema initialized and verified.")


def check_db_connectivity() -> bool:
    """
    Verifies live connectivity to the configured database.
    Enforces runtime query verification that the connected database meets isolation rules.
    Captures sanitized error message without exposing passwords if connection fails.
    """
    global _last_db_error
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            if engine.dialect.name == "postgresql":
                actual_db = conn.execute(text("SELECT current_database()")).scalar()
                validate_database_target(engine.url, live_db_name=actual_db)
        _last_db_error = None
        return True
    except Exception as e:
        sanitized = sanitize_db_url_or_error(str(e))
        _last_db_error = sanitized
        logger.warning("Database connectivity check failed: %s", sanitized)
        return False



def get_last_db_error() -> Optional[str]:
    """Returns the most recent sanitized database connection error, if any."""
    return _last_db_error


def get_db_dialect() -> Optional[str]:
    """
    Returns the dialect name of the active database engine (e.g. 'postgresql' or 'sqlite').
    """
    try:
        return get_engine().dialect.name
    except Exception:
        return "postgresql" if settings.is_db_configured else "sqlite"


def get_active_database_name() -> Optional[str]:
    """
    Returns the database name (e.g. 'inkloom_ai' or 'inkloom.db') of the active engine.
    Queries the live catalog from PostgreSQL metadata when connected.
    """
    try:
        engine = get_engine()
        if engine.dialect.name == "postgresql":
            with engine.connect() as conn:
                return conn.execute(text("SELECT current_database()")).scalar()
        return engine.url.database
    except Exception:
        try:
            return get_engine().url.database
        except Exception:
            return None


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session.
    """
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
