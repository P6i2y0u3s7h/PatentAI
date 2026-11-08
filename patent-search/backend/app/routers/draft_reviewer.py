"""
AI Patent Draft Reviewer Router.
Accepts patent draft text or PDF/DOCX file uploads, runs structural and technical audits,
identifies claim defects and ambiguities, and returns actionable recommendations.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.dependencies import get_optional_user
from app.models import (
    DraftReviewHistoryResponse,
    DraftReviewResponse,
)
from app.services import draft_reviewer_service, firestore_service
from app.services.document_service import extract_document_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/draft-review", tags=["AI Patent Draft Reviewer"])


@router.post("/analyze", response_model=DraftReviewResponse, summary="Analyze Patent Draft")
async def analyze_draft(
    invention_title: Annotated[str, Form()] = "",
    technical_field: Annotated[str, Form()] = "",
    review_type: Annotated[str, Form()] = "Comprehensive Review",
    pasted_text: Annotated[str, Form()] = "",
    draft_file: Annotated[Optional[UploadFile], File()] = None,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> DraftReviewResponse:
    """
    Perform a complete AI Patent Draft Review.
    Accepts direct text input or an uploaded PDF / Word (.docx) draft.
    """
    user_id = user.get("uid") if user else "anonymous"

    raw_text = pasted_text.strip()
    if draft_file:
        try:
            file_bytes = await draft_file.read()
            extracted = extract_document_text(file_bytes, draft_file.filename or "")
            if extracted:
                raw_text = extracted
        except Exception as exc:
            logger.error("[DRAFT_ROUTER] Document extraction failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not extract patent draft from uploaded file: {exc}",
            )

    if not raw_text or len(raw_text) < 30:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Patent draft text must be provided either via file upload (.pdf, .docx) or text paste (minimum 30 characters).",
        )

    try:
        review_result = await draft_reviewer_service.review_patent_draft(
            raw_text=raw_text,
            title=invention_title,
            technical_field=technical_field,
            review_type=review_type,
            user_id=user_id,
        )

        # Persist to database if user authenticated or session active
        firestore_service.save_draft_review(review_result.model_dump())

        return review_result

    except Exception as exc:
        logger.error("[DRAFT_ROUTER] Review execution error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while reviewing the patent draft: {exc}",
        )


@router.get("/history", response_model=DraftReviewHistoryResponse, summary="Get Draft Reviews History")
async def get_draft_reviews_history(
    limit: int = 30,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> DraftReviewHistoryResponse:
    """Retrieve previous patent draft review reports for the current user."""
    user_id = user.get("uid") if user else "anonymous"
    records = firestore_service.get_draft_reviews_by_user(user_id=user_id, limit=limit)
    return DraftReviewHistoryResponse(entries=records, total=len(records))


@router.get("/{review_id}", response_model=DraftReviewResponse, summary="Get Single Draft Review by ID")
async def get_draft_review(
    review_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> DraftReviewResponse:
    """Fetch complete review details and suggestions for a specific review report."""
    user_id = user.get("uid") if user else "anonymous"
    record = firestore_service.get_draft_review_by_id(review_id=review_id, user_id=user_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft review report '{review_id}' was not found.",
        )
    return DraftReviewResponse(**record)


@router.delete("/{review_id}", summary="Delete Draft Review")
async def delete_draft_review(
    review_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """Delete a draft review report from history."""
    user_id = user.get("uid") if user else "anonymous"
    success = firestore_service.delete_draft_review(review_id=review_id, user_id=user_id)
    return {"deleted_id": review_id, "success": success}
