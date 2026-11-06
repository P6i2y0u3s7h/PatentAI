"""
Patents Router: Patent catalog lookup, side-by-side comparison,
and comprehensive AI novelty analysis.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.dependencies import get_current_user
from app.models import (
    ComparisonHistoryResponse,
    DeleteHistoryResponse,
    NoveltyAnalysisRequest,
    NoveltyAnalysisResponse,
    NoveltyHistoryResponse,
    PatentCompareRequest,
    PatentComparisonResponse,
    PatentResult,
)
from app.services import (
    comparison_service,
    novelty_service,
    patent_service,
    pdf_service,
)
from app.utils import clean_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/patents", tags=["Patents, Comparison & Novelty"])


# ── Patent Listing & Lookup ───────────────────────────────────────────────────


@router.get("/list", summary="List All Indexed Patents")
async def list_patents(
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Return concise catalog of indexed patents for search and comparison pickers."""
    patents = patent_service.get_all_patents_list()
    return {"patents": patents, "total": len(patents)}


@router.get("/{patent_id}", response_model=PatentResult, summary="Get Single Patent by ID")
async def get_patent(
    patent_id: str,
    user: Annotated[dict, Depends(get_current_user)] = None,
) -> PatentResult:
    """Retrieve full metadata, abstract, and claims description for a patent."""
    raw = patent_service.get_patent_by_id(patent_id)
    return patent_service.to_patent_result(raw)


# ── Patent Comparison ─────────────────────────────────────────────────────────


@router.post("/compare", response_model=PatentComparisonResponse, summary="Compare Two Patents Side-by-Side")
async def compare_patents(
    body: PatentCompareRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> PatentComparisonResponse:
    """
    Perform deep technical comparison between Patent A and Patent B.
    Calculates cosine similarity, extracts structured parameters table,
    and generates an AI comparative breakdown covering similarities,
    differences, methodologies, and patent claims.
    """
    if body.patent_a_id.strip().upper() == body.patent_b_id.strip().upper():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select two distinct patents to compare.",
        )

    logger.info("[COMPARE] Comparing '%s' vs '%s' (uid='%s')", body.patent_a_id, body.patent_b_id, user.get("uid"))
    result = await comparison_service.execute_patent_comparison(
        user_id=user["uid"],
        patent_a_id=body.patent_a_id,
        patent_b_id=body.patent_b_id,
    )
    return result


@router.get("/compare/history", response_model=ComparisonHistoryResponse, summary="Get User Comparison History")
async def get_comparison_history(
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 20,
) -> ComparisonHistoryResponse:
    """Fetch recent patent comparisons performed by authenticated user."""
    entries = comparison_service.get_user_comparison_history(user["uid"], limit=limit)
    return ComparisonHistoryResponse(entries=entries, total=len(entries))


@router.delete("/compare/history/{entry_id}", response_model=DeleteHistoryResponse, summary="Delete Comparison Entry")
async def delete_comparison_history(
    entry_id: str,
    user: Annotated[dict, Depends(get_current_user)],
) -> DeleteHistoryResponse:
    """Delete a saved comparison from history."""
    deleted = comparison_service.delete_comparison_history_entry(entry_id, user["uid"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comparison history entry not found or access denied.",
        )
    return DeleteHistoryResponse(deleted_id=entry_id, success=True)


# ── AI Patent Novelty Analysis ────────────────────────────────────────────────


@router.post("/novelty-analysis", response_model=NoveltyAnalysisResponse, summary="Analyze Invention Novelty (JSON)")
async def analyze_novelty_json(
    body: NoveltyAnalysisRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> NoveltyAnalysisResponse:
    """
    Evaluate proposed invention against the patent database using FAISS retrieval
    and AI novelty scoring.
    """
    result = await novelty_service.analyze_invention_novelty(
        user_id=user["uid"],
        title=body.title,
        description=body.description,
        technical_details=body.technical_details or "",
        claims=body.claims or "",
    )
    return result


@router.post("/novelty-analysis/pdf", response_model=NoveltyAnalysisResponse, summary="Analyze Invention Novelty with PDF Upload")
async def analyze_novelty_pdf(
    file: UploadFile = File(..., description="Invention disclosure document in PDF"),
    title: str = Form(..., min_length=3, max_length=500),
    description: Optional[str] = Form(default=""),
    technical_details: Optional[str] = Form(default=""),
    claims: Optional[str] = Form(default=""),
    user: Annotated[dict, Depends(get_current_user)] = None,
) -> NoveltyAnalysisResponse:
    """
    Extract text from an uploaded invention disclosure PDF, combine with form metadata,
    and execute complete AI novelty analysis.
    """
    file_bytes = await file.read()
    extracted_text = pdf_service.extract_text_from_pdf(file_bytes, file.filename or "disclosure.pdf")
    cleaned_extracted = clean_text(extracted_text)

    # Use extracted text if description is short or empty
    combined_desc = description.strip()
    if not combined_desc or len(combined_desc) < 30:
        combined_desc = cleaned_extracted
    else:
        combined_desc = f"{combined_desc}\n\n[Extracted from {file.filename}]:\n{cleaned_extracted}"

    result = await novelty_service.analyze_invention_novelty(
        user_id=user["uid"],
        title=title,
        description=combined_desc,
        technical_details=technical_details or "",
        claims=claims or "",
    )
    return result


@router.get("/novelty/history", response_model=NoveltyHistoryResponse, summary="Get Novelty Analysis History")
async def get_novelty_history(
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 20,
) -> NoveltyHistoryResponse:
    """Retrieve user's saved novelty analysis records."""
    entries = novelty_service.get_user_novelty_history(user["uid"], limit=limit)
    return NoveltyHistoryResponse(entries=entries, total=len(entries))


@router.delete("/novelty/history/{entry_id}", response_model=DeleteHistoryResponse, summary="Delete Novelty History Entry")
async def delete_novelty_history(
    entry_id: str,
    user: Annotated[dict, Depends(get_current_user)],
) -> DeleteHistoryResponse:
    """Delete a novelty analysis record."""
    deleted = novelty_service.delete_novelty_history_entry(entry_id, user["uid"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novelty analysis record not found or access denied.",
        )
    return DeleteHistoryResponse(deleted_id=entry_id, success=True)

