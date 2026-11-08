"""
AI Claim Chart Generator Router.
Compares patent claims against another patent, technical specification,
or product description, generating element-by-element mapping charts.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.dependencies import get_optional_user
from app.models import (
    ClaimChartHistoryResponse,
    ClaimChartResponse,
)
from app.services import claim_chart_service, firestore_service, patent_service
from app.services.document_service import extract_document_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/claim-chart", tags=["AI Claim Chart Generator"])


@router.post("/generate", response_model=ClaimChartResponse, summary="Generate AI Claim Chart")
async def generate_claim_chart(
    comparison_title: Annotated[str, Form()] = "",
    # Document A inputs (Patent Claims)
    doc_a_patent_id: Annotated[str, Form()] = "",
    doc_a_text: Annotated[str, Form()] = "",
    doc_a_name: Annotated[str, Form()] = "Patent Claims (Doc A)",
    doc_a_file: Annotated[Optional[UploadFile], File()] = None,
    # Document B inputs (Comparison Document / Prior Art)
    doc_b_patent_id: Annotated[str, Form()] = "",
    doc_b_text: Annotated[str, Form()] = "",
    doc_b_name: Annotated[str, Form()] = "Comparison Document (Doc B)",
    doc_b_file: Annotated[Optional[UploadFile], File()] = None,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> ClaimChartResponse:
    """
    Generate an exhaustive, element-by-element patent claim chart comparing
    Document A's claims against Document B's technical evidence.
    """
    user_id = user.get("uid") if user else "anonymous"

    # Resolve Document A text
    resolved_text_a = doc_a_text.strip()
    resolved_name_a = doc_a_name.strip() or "Patent Claims"

    if doc_a_patent_id.strip():
        try:
            pat_a = patent_service.get_patent_by_id(doc_a_patent_id.strip())
            resolved_text_a = f"Title: {pat_a.get('title')}\n\nClaims / Description:\n{pat_a.get('description', '')}"
            resolved_name_a = f"{pat_a.get('id')} - {pat_a.get('title')}"
        except Exception as e:
            logger.warning("[CLAIM_CHART] Could not load Patent A by ID: %s", e)

    if doc_a_file:
        try:
            f_bytes = await doc_a_file.read()
            extracted = extract_document_text(f_bytes, doc_a_file.filename or "")
            if extracted:
                resolved_text_a = extracted
                resolved_name_a = doc_a_file.filename or "Uploaded Patent Claims"
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not extract Document A: {e}",
            )

    # Resolve Document B text
    resolved_text_b = doc_b_text.strip()
    resolved_name_b = doc_b_name.strip() or "Comparison Document"

    if doc_b_patent_id.strip():
        try:
            pat_b = patent_service.get_patent_by_id(doc_b_patent_id.strip())
            resolved_text_b = f"Title: {pat_b.get('title')}\n\nAbstract: {pat_b.get('abstract')}\n\nDetailed Description:\n{pat_b.get('description', '')}"
            resolved_name_b = f"{pat_b.get('id')} - {pat_b.get('title')}"
        except Exception as e:
            logger.warning("[CLAIM_CHART] Could not load Patent B by ID: %s", e)

    if doc_b_file:
        try:
            f_bytes = await doc_b_file.read()
            extracted = extract_document_text(f_bytes, doc_b_file.filename or "")
            if extracted:
                resolved_text_b = extracted
                resolved_name_b = doc_b_file.filename or "Uploaded Comparison Document"
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not extract Document B: {e}",
            )

    if len(resolved_text_a) < 30:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document A (Patent Claims) must contain at least 30 characters of claim text, or select an indexed patent.",
        )

    if len(resolved_text_b) < 30:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document B (Comparison Document) must contain at least 30 characters of technical text, or select an indexed patent.",
        )

    title = comparison_title.strip() or f"Claim Chart: {resolved_name_a[:40]} vs {resolved_name_b[:40]}"

    try:
        chart_result = await claim_chart_service.generate_claim_chart(
            doc_a_text=resolved_text_a,
            doc_b_text=resolved_text_b,
            doc_a_name=resolved_name_a,
            doc_b_name=resolved_name_b,
            title=title,
            user_id=user_id,
        )

        firestore_service.save_claim_chart(chart_result.model_dump())

        return chart_result

    except Exception as exc:
        logger.error("[CLAIM_CHART_ROUTER] Generation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI Claim Chart: {exc}",
        )


@router.get("/history", response_model=ClaimChartHistoryResponse, summary="Get Claim Charts History")
async def get_claim_charts_history(
    limit: int = 30,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> ClaimChartHistoryResponse:
    """Retrieve previously generated claim charts for the current user."""
    user_id = user.get("uid") if user else "anonymous"
    records = firestore_service.get_claim_charts_by_user(user_id=user_id, limit=limit)
    return ClaimChartHistoryResponse(entries=records, total=len(records))


@router.get("/{chart_id}", response_model=ClaimChartResponse, summary="Get Single Claim Chart by ID")
async def get_claim_chart(
    chart_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> ClaimChartResponse:
    """Retrieve full comparison table elements and analysis for a specific claim chart."""
    user_id = user.get("uid") if user else "anonymous"
    record = firestore_service.get_claim_chart_by_id(chart_id=chart_id, user_id=user_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim chart '{chart_id}' was not found.",
        )
    return ClaimChartResponse(**record)


@router.delete("/{chart_id}", summary="Delete Claim Chart")
async def delete_claim_chart(
    chart_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """Delete a saved claim chart from history."""
    user_id = user.get("uid") if user else "anonymous"
    success = firestore_service.delete_claim_chart(chart_id=chart_id, user_id=user_id)
    return {"deleted_id": chart_id, "success": success}
