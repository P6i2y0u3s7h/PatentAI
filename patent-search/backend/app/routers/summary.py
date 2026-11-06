"""
Summary router: text and PDF summarization using BART.
"""

import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.dependencies import get_current_user
from app.models import SummaryRequest, SummaryResponse
from app.services import pdf_service, summary_service
from app.utils import clean_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/summary", tags=["Summarization"])


@router.post("", response_model=SummaryResponse, summary="Summarize Patent Text")
@router.post("/", response_model=SummaryResponse, include_in_schema=False)
async def summarize_text(
    body: SummaryRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> SummaryResponse:
    """
    Generate an AI summary of patent text using BART-large-CNN.
    Requires a valid Firebase ID token in the Authorization header.
    Input text is automatically truncated to fit the model's context window.
    """
    start_ms = time.perf_counter() * 1000

    logger.info("[SUMMARY] Processing text summary request (%d chars)", len(body.text))
    cleaned = clean_text(body.text)
    summary = summary_service.summarize(cleaned)

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    return SummaryResponse(
        summary=summary,
        original_length=len(cleaned),
        summary_length=len(summary),
        processing_time_ms=round(elapsed_ms, 2),
    )


@router.post("/pdf", response_model=SummaryResponse, summary="Summarize PDF")
async def summarize_pdf(
    file: UploadFile = File(..., description="PDF file to summarize"),
    user: Annotated[dict, Depends(get_current_user)] = None,
) -> SummaryResponse:
    """
    Extract text from an uploaded PDF and generate an AI summary.
    Requires a valid Firebase ID token in the Authorization header.
    """
    start_ms = time.perf_counter() * 1000

    file_bytes = await file.read()
    logger.info("[SUMMARY PDF] Received file: filename='%s', size=%d bytes", file.filename, len(file_bytes))

    extracted_text = pdf_service.extract_text_from_pdf(file_bytes, file.filename or "")
    cleaned = clean_text(extracted_text)

    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text could be extracted from this PDF. Please ensure the PDF is text-based.",
        )

    summary = summary_service.summarize(cleaned)

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    return SummaryResponse(
        summary=summary,
        original_length=len(cleaned),
        summary_length=len(summary),
        processing_time_ms=round(elapsed_ms, 2),
    )
