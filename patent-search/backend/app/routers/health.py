"""
Health check router.
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.firebase_admin_init import get_firebase_available
from app.models import HealthResponse
from app.services.embedding_service import is_embedding_model_loaded
from app.services.search_service import is_index_loaded
from app.services.summary_service import is_summarization_model_loaded

router = APIRouter(tags=["Health"])

_start_time = time.time()


@router.get("/health", response_model=HealthResponse, summary="Health Check")
async def health_check() -> HealthResponse:
    """
    Returns the current health status of the service including:
    - FAISS index load status
    - Embedding model load status
    - Summarization model load status
    - Firebase connectivity
    """
    settings = get_settings()
    uptime = time.time() - _start_time

    faiss_ok = is_index_loaded()
    embed_ok = is_embedding_model_loaded()
    summary_ok = is_summarization_model_loaded()
    firebase_ok = get_firebase_available()

    overall_status = "healthy" if faiss_ok and embed_ok else "degraded"

    return HealthResponse(
        status=overall_status,
        version=settings.APP_VERSION,
        faiss_loaded=faiss_ok,
        embedding_model_loaded=embed_ok,
        summarization_model_loaded=summary_ok,
        firebase_connected=firebase_ok,
        uptime_seconds=round(uptime, 2),
    )
