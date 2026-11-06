"""
Search router: handles text and PDF patent search.
"""

import logging
import time
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.dependencies import get_current_user
from app.models import SearchRequest, SearchResponse
from app.services import embedding_service, firestore_service, pdf_service, search_service
from app.utils import clean_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["Search"])


def _async_save_history(
    user_id: str,
    query_snippet: str,
    top_result_title: str | None,
    top_result_score: float | None,
    result_count: int,
    source: str,
) -> None:
    """Non-blocking background task to persist search history without delaying HTTP response."""
    try:
        firestore_service.save_search_history(
            user_id=user_id,
            query_snippet=query_snippet,
            top_result_title=top_result_title,
            top_result_score=top_result_score,
            result_count=result_count,
            source=source,
        )
    except Exception as exc:
        logger.warning("[HISTORY] Background history save skipped or failed (non-fatal): %s", exc)


@router.post("/", response_model=SearchResponse, summary="Search Patents by Text")
async def search_by_text(
    body: SearchRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[dict, Depends(get_current_user)],
) -> SearchResponse:
    """
    Perform semantic patent prior-art search using a text query.
    Requires a valid Firebase ID token in the Authorization header.
    Returns top-K similar patents ranked by cosine similarity.
    """
    start_ms = time.perf_counter() * 1000

    cleaned_query = clean_text(body.query)
    if len(cleaned_query) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query text is too short after cleaning. Please provide more detail.",
        )

    logger.info("[SEARCH] text query: %d chars, top_k=%d, uid='%s'", len(cleaned_query), body.top_k, user.get("uid"))

    # Offload CPU-bound embedding and vector search to worker threads
    embedding = await run_in_threadpool(embedding_service.get_embedding, cleaned_query)
    results = await run_in_threadpool(search_service.search, embedding, body.top_k, cleaned_query)
    logger.info("[FAISS] returned %d results", len(results))

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    # Persist to Firestore asynchronously in background so response is dispatched immediately
    top = results[0] if results else None
    background_tasks.add_task(
        _async_save_history,
        user_id=user["uid"],
        query_snippet=cleaned_query[:500],
        top_result_title=top.title if top else None,
        top_result_score=top.similarity_score if top else None,
        result_count=len(results),
        source="text",
    )

    return SearchResponse(
        results=results,
        query_length=len(cleaned_query),
        total_found=len(results),
        search_time_ms=round(elapsed_ms, 2),
    )


@router.post("/pdf", response_model=SearchResponse, summary="Search Patents by PDF Upload")
async def search_by_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF file to search with"),
    top_k: int = Form(default=10, ge=1, le=50),
    user: Annotated[dict, Depends(get_current_user)] = None,
) -> SearchResponse:
    """
    Extract text from an uploaded PDF and perform semantic patent search.
    Requires a valid Firebase ID token in the Authorization header.
    """
    start_ms = time.perf_counter() * 1000

    logger.info(
        "[PDF] received: filename='%s', content_type='%s', top_k=%d, uid='%s'",
        file.filename or "unknown",
        file.content_type or "unknown",
        top_k,
        user.get("uid") if user else "anonymous",
    )

    file_bytes = await file.read()
    extracted_text = await run_in_threadpool(pdf_service.extract_text_from_pdf, file_bytes, file.filename or "")
    cleaned_query = clean_text(extracted_text)

    embedding = await run_in_threadpool(embedding_service.get_embedding, cleaned_query)
    results = await run_in_threadpool(search_service.search, embedding, top_k, cleaned_query)
    logger.info("[FAISS] PDF search returned %d results", len(results))

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    # Persist to Firestore asynchronously in background
    if user and user.get("uid"):
        top = results[0] if results else None
        background_tasks.add_task(
            _async_save_history,
            user_id=user["uid"],
            query_snippet=cleaned_query[:500],
            top_result_title=top.title if top else None,
            top_result_score=top.similarity_score if top else None,
            result_count=len(results),
            source="pdf",
        )

    return SearchResponse(
        results=results,
        query_length=len(cleaned_query),
        total_found=len(results),
        search_time_ms=round(elapsed_ms, 2),
    )


@router.get("/history", summary="Get Search History")
async def get_history(
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    """Return the authenticated user's search history."""
    from app.models import HistoryResponse

    entries = firestore_service.get_search_history(user["uid"], limit=limit)
    return HistoryResponse(entries=entries, total=len(entries))


@router.delete("/history/{entry_id}", summary="Delete a History Entry")
async def delete_history(
    entry_id: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Delete a specific search history entry for the authenticated user."""
    from app.models import DeleteHistoryResponse

    deleted = firestore_service.delete_history_entry(entry_id, user["uid"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History entry not found or access denied.",
        )
    return DeleteHistoryResponse(deleted_id=entry_id, success=True)
