"""
Novelty analysis service: coordinates FAISS retrieval, feature analysis,
AI report generation, and Firestore persistence.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np

from app.firebase_admin_init import get_firebase_available
from app.models import (
    AIRecommendations,
    NoveltyAnalysisResponse,
    NoveltyHistoryEntry,
    NoveltyOverview,
    NoveltyPatentReference,
    TechnicalFeatureAnalysis,
)
from app.services import embedding_service, llm_service, patent_service, search_service
from app.utils import clean_text

logger = logging.getLogger(__name__)

COLLECTION_NAME = "novelty_analyses"
_in_memory_analyses: dict[str, dict[str, Any]] = {}


def _get_db():
    if not get_firebase_available():
        return None
    from firebase_admin import firestore
    return firestore.client()


async def analyze_invention_novelty(
    user_id: str,
    title: str,
    description: str,
    technical_details: str = "",
    claims: str = "",
) -> NoveltyAnalysisResponse:
    """
    Execute full novelty analysis pipeline:
    1. Clean input
    2. Embed title + description
    3. Retrieve top 10 relevant patents from FAISS
    4. Run deep AI novelty synthesis
    5. Persist result to Firestore
    """
    start_time = datetime.now(tz=timezone.utc)
    cleaned_desc = clean_text(description)
    query_text = f"{title}. {cleaned_desc} {clean_text(technical_details)}"

    logger.info("[NOVELTY] Starting analysis for '%s' (%d chars, uid='%s')", title, len(query_text), user_id)

    # Step 3: Embed
    embedding = embedding_service.get_embedding(query_text)

    # Step 4 & 5: Retrieve top 10 from FAISS
    search_results = search_service.search(embedding, top_k=10, query_text=query_text)
    logger.info("[NOVELTY] Retrieved %d prior-art patents from FAISS.", len(search_results))

    # Convert search results to dict format
    retrieved_patents: list[dict[str, Any]] = []
    prior_art_refs: list[NoveltyPatentReference] = []

    for r in search_results:
        retrieved_patents.append({
            "id": r.id,
            "title": r.title,
            "abstract": r.abstract,
            "description": r.description,
            "assignee": r.assignee,
            "publication_date": r.publication_date,
            "ipc_class": r.ipc_class,
            "similarity_score": r.similarity_score,
        })

        features = patent_service.extract_technical_features(f"{r.abstract} {r.description}")
        prior_art_refs.append(
            NoveltyPatentReference(
                id=r.id,
                title=r.title,
                abstract=r.abstract,
                similarity_percentage=round(r.similarity_score * 100, 1),
                relevant_features=features[:3],
                assignee=r.assignee,
                publication_date=r.publication_date,
                ipc_class=r.ipc_class,
            )
        )

    # Step 6 & 7: AI Novelty Synthesis
    ai_result = await llm_service.generate_novelty_analysis(
        title=title,
        description=cleaned_desc,
        technical_details=technical_details,
        claims=claims,
        retrieved_patents=retrieved_patents,
    )

    overview = NoveltyOverview(
        novelty_score=ai_result["novelty_score"],
        novelty_verdict=ai_result["novelty_verdict"],
        confidence_score=ai_result["confidence_score"],
        relevant_patents_count=len(retrieved_patents),
        most_relevant_patent_id=ai_result["most_relevant_patent_id"],
        most_relevant_patent_title=ai_result["most_relevant_patent_title"],
        highest_similarity_score=ai_result["highest_similarity_score"],
    )

    tech_features = TechnicalFeatureAnalysis(
        disclosed_features=ai_result["disclosed_features"],
        distinguishing_features=ai_result["distinguishing_features"],
        similar_technical_approaches=ai_result["similar_technical_approaches"],
        potential_overlaps=ai_result["potential_overlaps"],
    )

    recommendations = AIRecommendations(
        areas_for_investigation=ai_result["areas_for_investigation"],
        distinguishing_features_guidance=ai_result["distinguishing_features_guidance"],
        suggested_prior_art_searches=ai_result["suggested_prior_art_searches"],
    )

    disclaimer = (
        "IMPORTANT LEGAL NOTICE: This analysis represents a preliminary, automated AI prior-art assessment "
        "designed for research and informational purposes. It does NOT constitute a formal legal opinion, "
        "freedom-to-operate (FTO) clearance, or a guarantee of patentability by the USPTO, EPO, or any patent authority. "
        "Always consult a registered patent attorney or patent agent before filing or public disclosure."
    )

    analysis_id = str(uuid.uuid4())
    end_time = datetime.now(tz=timezone.utc)
    elapsed_ms = (end_time - start_time).total_seconds() * 1000

    response = NoveltyAnalysisResponse(
        id=analysis_id,
        title=title,
        overview=overview,
        technical_features=tech_features,
        prior_art_references=prior_art_refs,
        recommendations=recommendations,
        final_summary=ai_result["final_summary"],
        disclaimer=disclaimer,
        created_at=start_time,
        processing_time_ms=round(elapsed_ms, 2),
    )

    # Persist to Firestore
    save_novelty_history(user_id, response)

    return response


def save_novelty_history(user_id: str, response: NoveltyAnalysisResponse) -> None:
    """Save novelty analysis entry to Firestore."""
    db = _get_db()
    data = {
        "id": response.id,
        "user_id": user_id,
        "title": response.title,
        "novelty_verdict": response.overview.novelty_verdict,
        "highest_similarity_score": response.overview.highest_similarity_score,
        "relevant_patents_count": response.overview.relevant_patents_count,
        "created_at": response.created_at,
        "overview": response.overview.model_dump(),
        "final_summary": response.final_summary[:500],
    }

    if db is not None:
        try:
            db.collection(COLLECTION_NAME).document(response.id).set(data, timeout=5.0)
            logger.info("[NOVELTY] Saved analysis %s for user %s to Firestore", response.id, user_id)
        except Exception as exc:
            logger.warning("[NOVELTY] Firestore save failed, fallback to memory: %s", exc)
            _in_memory_analyses[response.id] = data
    else:
        _in_memory_analyses[response.id] = data


def get_user_novelty_history(user_id: str, limit: int = 20) -> list[NoveltyHistoryEntry]:
    """Retrieve past novelty analyses for authenticated user."""
    db = _get_db()
    raw_docs: list[dict[str, Any]] = []

    if db is not None:
        try:
            docs = (
                db.collection(COLLECTION_NAME)
                .where("user_id", "==", user_id)
                .stream()
            )
            for d in docs:
                raw_docs.append(d.to_dict())
        except Exception as exc:
            logger.warning("[NOVELTY] Firestore history fetch failed: %s", exc)

    for d in _in_memory_analyses.values():
        if d.get("user_id") == user_id and not any(r.get("id") == d.get("id") for r in raw_docs):
            raw_docs.append(d)

    entries: list[NoveltyHistoryEntry] = []
    for data in raw_docs:
        c_at = data.get("created_at")
        if hasattr(c_at, "datetime"):
            c_at = c_at.datetime().replace(tzinfo=timezone.utc)
        elif not isinstance(c_at, datetime):
            c_at = datetime.now(tz=timezone.utc)

        entries.append(
            NoveltyHistoryEntry(
                id=str(data.get("id", "")),
                user_id=str(data.get("user_id", user_id)),
                title=str(data.get("title", "Untitled Analysis")),
                novelty_verdict=str(data.get("novelty_verdict", "Evaluated")),
                highest_similarity_score=float(data.get("highest_similarity_score", 0.0)),
                relevant_patents_count=int(data.get("relevant_patents_count", 10)),
                created_at=c_at,
            )
        )

    entries.sort(key=lambda x: x.created_at, reverse=True)
    return entries[:limit]


def delete_novelty_history_entry(entry_id: str, user_id: str) -> bool:
    """Delete a novelty analysis entry."""
    db = _get_db()
    deleted = False

    if db is not None:
        try:
            doc_ref = db.collection(COLLECTION_NAME).document(entry_id)
            doc = doc_ref.get()
            if doc.exists and doc.to_dict().get("user_id") == user_id:
                doc_ref.delete()
                deleted = True
        except Exception as exc:
            logger.warning("[NOVELTY] Failed to delete Firestore doc %s: %s", entry_id, exc)

    if entry_id in _in_memory_analyses and _in_memory_analyses[entry_id].get("user_id") == user_id:
        del _in_memory_analyses[entry_id]
        deleted = True

    return deleted
