"""
Interactive Patent Similarity Network Router.
Generates cluster graphs showing semantic relationships between patents based on
vector distance, shared IPC categories, and core technical concepts.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.dependencies import get_optional_user
from app.models import (
    PatentNetworkHistoryResponse,
    PatentNetworkResponse,
)
from app.services import firestore_service, patent_network_service
from app.services.document_service import extract_document_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patent-network", tags=["Interactive Patent Similarity Network"])


@router.post("/generate", response_model=PatentNetworkResponse, summary="Generate Patent Similarity Network")
async def generate_network(
    patent_id: Annotated[str, Form()] = "",
    query_text: Annotated[str, Form()] = "",
    top_k: Annotated[int, Form()] = 12,
    min_similarity: Annotated[float, Form()] = 0.20,
    pdf_file: Annotated[Optional[UploadFile], File()] = None,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> PatentNetworkResponse:
    """
    Generate an interactive semantic network of related patents from the catalog.
    Can be seeded with a patent publication number (e.g. US-2024-001), query text, or a patent PDF.
    """
    user_id = user.get("uid") if user else "anonymous"

    extracted_query = query_text.strip()
    if pdf_file:
        try:
            file_bytes = await pdf_file.read()
            extracted = extract_document_text(file_bytes, pdf_file.filename or "")
            if extracted:
                extracted_query = extracted[:1500]
        except Exception as exc:
            logger.error("[NETWORK_ROUTER] File extraction error: %s", exc)

    try:
        network = patent_network_service.generate_patent_network(
            central_patent_id=patent_id.strip() or None,
            query_text=extracted_query or None,
            top_k=min(25, max(4, top_k)),
            min_similarity=max(0.0, min(1.0, min_similarity)),
            user_id=user_id,
        )

        firestore_service.save_patent_network(network.model_dump())

        return network

    except Exception as exc:
        logger.error("[NETWORK_ROUTER] Network generation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate similarity network: {exc}",
        )


@router.get("/patent/{patent_id}", response_model=PatentNetworkResponse, summary="Generate Network by Patent ID")
async def generate_network_by_patent_id(
    patent_id: str,
    top_k: int = 12,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> PatentNetworkResponse:
    """Quick generation of a similarity network for a specific catalog patent."""
    user_id = user.get("uid") if user else "anonymous"
    try:
        network = patent_network_service.generate_patent_network(
            central_patent_id=patent_id,
            top_k=top_k,
            user_id=user_id,
        )
        firestore_service.save_patent_network(network.model_dump())
        return network
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not build network for patent '{patent_id}': {exc}",
        )


@router.get("/history", response_model=PatentNetworkHistoryResponse, summary="Get Patent Networks History")
async def get_networks_history(
    limit: int = 30,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> PatentNetworkHistoryResponse:
    """Retrieve previously generated similarity networks for the current user."""
    user_id = user.get("uid") if user else "anonymous"
    records = firestore_service.get_patent_networks_by_user(user_id=user_id, limit=limit)
    return PatentNetworkHistoryResponse(entries=records, total=len(records))


@router.get("/{network_id}", response_model=PatentNetworkResponse, summary="Get Single Patent Network by ID")
async def get_network(
    network_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
) -> PatentNetworkResponse:
    """Retrieve full graph nodes and edges for a previously saved network."""
    user_id = user.get("uid") if user else "anonymous"
    record = firestore_service.get_patent_network_by_id(net_id=network_id, user_id=user_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patent network '{network_id}' was not found.",
        )
    return PatentNetworkResponse(**record)


@router.delete("/{network_id}", summary="Delete Patent Network")
async def delete_network(
    network_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """Delete a saved patent network from history."""
    user_id = user.get("uid") if user else "anonymous"
    success = firestore_service.delete_patent_network(net_id=network_id, user_id=user_id)
    return {"deleted_id": network_id, "success": success}
