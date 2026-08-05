"""
Summary router: text and PDF summarization using BART.
"""

import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.dependencies import get_optional_user
from app.models import SummaryRequest, SummaryResponse
from app.services import pdf_service, summary_service
from app.utils import clean_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/summary", tags=["Summarization"])


@router.post("/", response_model=SummaryResponse, summary="Summarize Patent Text")
async def summarize_text(
    body: SummaryRequest,
    user: Annotated[dict | None, Depends(get_optional_user)] = None,
) -> SummaryResponse:
    """
    Generate an AI summary of patent text using BART-large-CNN.
    Input text is automatically truncated to fit the model's context window.
    """
    start_ms = time.perf_counter() * 1000

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
    user: Annotated[dict | None, Depends(get_optional_user)] = None,
) -> SummaryResponse:
    """
    Extract text from an uploaded PDF and generate an AI summary.
    """
    start_ms = time.perf_counter() * 1000

    file_bytes = await file.read()
    extracted_text = pdf_service.extract_text_from_pdf(file_bytes, file.filename or "")
    cleaned = clean_text(extracted_text)
    summary = summary_service.summarize(cleaned)

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    return SummaryResponse(
        summary=summary,
        original_length=len(cleaned),
        summary_length=len(summary),
        processing_time_ms=round(elapsed_ms, 2),
    )
