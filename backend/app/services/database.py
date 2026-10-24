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


def get_normalized_database_url() -> str:
    """
    Returns the normalized database connection URL.
    Supports PostgreSQL (via psycopg) strictly for 'inkloom_ai',
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
            target_db = (parsed.database or "").strip().lower()
            if target_db == "polar_logistics":
                raise ValueError(
                    "Database isolation violation: Inkloom AI cannot connect to 'polar_logistics'. "
                    "Inkloom AI must connect strictly to its dedicated database 'inkloom_ai'."
                )
            if target_db and target_db != "inkloom_ai":
                raise ValueError(
                    f"Database isolation violation: Inkloom AI must connect strictly to 'inkloom_ai' "
                    f"(configured: '{target_db}')."
                )
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
        # PostgreSQL connection pooling
        _engine = create_engine(
            url,
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
    Initializes database schema, creating tables and indexes idempotently.
    Enforces runtime wire-level guard ensuring the active database is strictly 'inkloom_ai'.
    """
    target_engine = engine or get_engine()
    if target_engine.dialect.name == "postgresql":
        with target_engine.connect() as conn:
            actual_db = conn.execute(text("SELECT current_database()")).scalar()
            if actual_db == "polar_logistics":
                raise ValueError(
                    "Database isolation violation: Attempted to run schema initialization on forbidden database 'polar_logistics'. "
                    "Inkloom AI must connect strictly to 'inkloom_ai'."
                )
            if actual_db != "inkloom_ai":
                raise ValueError(
                    f"Database isolation violation: Connected PostgreSQL database is '{actual_db}', "
                    f"must be strictly 'inkloom_ai'."
                )
    Base.metadata.create_all(bind=target_engine)
    logger.info("Database schema initialized and verified.")


def check_db_connectivity() -> bool:
    """
    Verifies live connectivity to the configured database.
    Enforces runtime query verification that the connected database is strictly 'inkloom_ai'.
    Captures sanitized error message without exposing passwords if connection fails.
    """
    global _last_db_error
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            if engine.dialect.name == "postgresql":
                actual_db = conn.execute(text("SELECT current_database()")).scalar()
                if actual_db == "polar_logistics":
                    raise ValueError(
                        "Database isolation violation: Connected to forbidden database 'polar_logistics'. "
                        "Inkloom AI must connect strictly to 'inkloom_ai'."
                    )
                if actual_db != "inkloom_ai":
                    raise ValueError(
                        f"Database isolation violation: Connected PostgreSQL database is '{actual_db}', "
                        f"must be strictly 'inkloom_ai'."
                    )
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
