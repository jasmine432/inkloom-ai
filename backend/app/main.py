import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.api.routes import router
from backend.app.api.chat_routes import router as chat_router
from backend.app.services.source_store import source_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("inkloom_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure approved source repositories are loaded and indexed
    source_store.reload()
    try:
        from backend.app.services.database import init_db, check_db_connectivity
        init_db()
        db_ok = check_db_connectivity()
        logger.info(f"Database initialized. Live connectivity: {db_ok}")
    except Exception as e:
        logger.warning(f"Database initialization notice: {e}")

    logger.info(
        f"Inkloom AI Backend initialized. LLM Provider: '{settings.LLM_PROVIDER}' "
        f"(configured: {settings.is_llm_configured}). "
        f"Sources loaded: {len(source_store.get_all_sources())}"
    )
    yield
    # Shutdown logic if needed
    logger.info("Inkloom AI Backend shutting down.")


app = FastAPI(
    title="Inkloom AI Backend",
    description="Content Review & Brand Fact-Checking Engine for marketing copy and brand compliance.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration restricted strictly to Vite development origin(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount API endpoints
app.include_router(router)
app.include_router(chat_router)


@app.get("/", tags=["Root"])
def root_status():
    return {
        "service": "Inkloom AI API",
        "status": "operational",
        "documentation": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
