"""
FastAPI application factory with lifespan startup/shutdown.
"""

import logging

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import InMemoryRateLimiter, RequestTimingMiddleware, SecurityHeadersMiddleware
from app.firebase_admin_init import initialize_firebase
from app.routers import assistant, auth, health, patents, research, search, summary
from app.services.embedding_service import load_embedding_model
from app.services.search_service import load_index
from app.services.summary_service import load_summarization_model

settings = get_settings()

# Bootstrap logging before anything else
setup_logging(log_level=settings.LOG_LEVEL, log_file=settings.LOG_FILE)
logger = logging.getLogger("patentai")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: load models and indexes on startup."""
    logger.info("═══ PatentAI Backend Starting ═══")

    # Firebase
    initialize_firebase()

    # FAISS index (non-fatal if missing)
    try:
        load_index()
    except Exception as exc:
        logger.warning("FAISS index could not be loaded: %s", exc)

    # Embedding model (required for search)
    try:
        load_embedding_model()
    except Exception as exc:
        logger.error("Embedding model failed to load: %s", exc)

    logger.info("═══ PatentAI Backend Ready ═══")
    yield
    logger.info("═══ PatentAI Backend Shutting Down ═══")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="AI-powered Patent Prior-Art Search Platform",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Custom Middleware (order matters — outermost first) ───────────────────
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestTimingMiddleware)
    app.add_middleware(
        InMemoryRateLimiter,
        max_requests=settings.RATE_LIMIT_REQUESTS,
        window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
    )

    # ── Exception Handlers ────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(search.router)
    app.include_router(summary.router)
    app.include_router(assistant.router)
    app.include_router(patents.router)
    app.include_router(research.router)

    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": f"Welcome to {settings.APP_NAME} API v{settings.APP_VERSION}"}

    return app


app = create_app()
