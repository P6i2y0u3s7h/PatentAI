"""
Patent comparison service: side-by-side technical evaluation,
cosine similarity calculation, AI claims comparison, and Firestore persistence.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.firebase_admin_init import get_firebase_available
from app.models import (
    ComparisonHistoryEntry,
    PatentComparisonResponse,
    PatentFeatureComparison,
)
from app.services import embedding_service, llm_service, patent_service

logger = logging.getLogger(__name__)

COLLECTION_NAME = "patent_comparisons"
_in_memory_comparisons: dict[str, dict[str, Any]] = {}


def _get_db():
    if not get_firebase_available():
        return None
    from firebase_admin import firestore
    return firestore.client()


async def execute_patent_comparison(
    user_id: str,
    patent_a_id: str,
    patent_b_id: str,
) -> PatentComparisonResponse:
    """Compare two patents side-by-side using actual patent disclosures and AI analysis."""
    start_ms = time.perf_counter() * 1000

    raw_a = patent_service.get_patent_by_id(patent_a_id)
    raw_b = patent_service.get_patent_by_id(patent_b_id)

    # Compute semantic cosine similarity
    text_a = f"{raw_a.get('title', '')} {raw_a.get('abstract', '')} {raw_a.get('description', '')}"
    text_b = f"{raw_b.get('title', '')} {raw_b.get('abstract', '')} {raw_b.get('description', '')}"

    similarity_score = 0.5
    try:
        emb_a = embedding_service.get_embedding(text_a)
        emb_b = embedding_service.get_embedding(text_b)
        dot_product = float(np.dot(emb_a, emb_b))
        similarity_score = max(0.0, min(1.0, dot_product))
    except Exception as exc:
        logger.warning("[COMPARE] Embedding similarity calculation fallback: %s", exc)
        # Lexical keyword overlap fallback
        from app.utils import extract_keywords
        kwa = set(extract_keywords(text_a, top_n=30))
        kwb = set(extract_keywords(text_b, top_n=30))
        if kwa and kwb:
            jaccard = len(kwa & kwb) / len(kwa | kwb)
            similarity_score = round(0.3 + (0.6 * jaccard), 3)

    sim_pct = round(similarity_score * 100, 1)

    # Structured features
    claims_a = patent_service.extract_patent_claims(raw_a)
    claims_b = patent_service.extract_patent_claims(raw_b)

    approach_a = patent_service.extract_technical_approach(raw_a)
    approach_b = patent_service.extract_technical_approach(raw_b)

    # Side-by-side parameter table
    parameters_table: list[PatentFeatureComparison] = [
        PatentFeatureComparison(
            parameter="Patent Title",
            patent_a=str(raw_a.get("title", "")),
            patent_b=str(raw_b.get("title", "")),
        ),
        PatentFeatureComparison(
            parameter="Patent ID",
            patent_a=str(raw_a.get("id", "")),
            patent_b=str(raw_b.get("id", "")),
        ),
        PatentFeatureComparison(
            parameter="Assignee / Applicant",
            patent_a=str(raw_a.get("assignee", "Unknown")),
            patent_b=str(raw_b.get("assignee", "Unknown")),
        ),
        PatentFeatureComparison(
            parameter="Publication Date & Country",
            patent_a=f"{raw_a.get('publication_date', '')} ({raw_a.get('country', '')})",
            patent_b=f"{raw_b.get('publication_date', '')} ({raw_b.get('country', '')})",
        ),
        PatentFeatureComparison(
            parameter="IPC Classification",
            patent_a=str(raw_a.get("ipc_class", "N/A")),
            patent_b=str(raw_b.get("ipc_class", "N/A")),
        ),
        PatentFeatureComparison(
            parameter="Abstract",
            patent_a=str(raw_a.get("abstract", "")),
            patent_b=str(raw_b.get("abstract", "")),
        ),
        PatentFeatureComparison(
            parameter="Technology",
            patent_a=f"{raw_a.get('ipc_class', 'Technology')} - {raw_a.get('title', '')}",
            patent_b=f"{raw_b.get('ipc_class', 'Technology')} - {raw_b.get('title', '')}",
        ),
        PatentFeatureComparison(
            parameter="Main Claims",
            patent_a=claims_a,
            patent_b=claims_b,
        ),
        PatentFeatureComparison(
            parameter="Technical Approach",
            patent_a=approach_a,
            patent_b=approach_b,
        ),
    ]

    # AI Deep Comparison
    ai_analysis = await llm_service.generate_patent_comparison(raw_a, raw_b, similarity_score)

    patent_res_a = patent_service.to_patent_result(raw_a, 1.0)
    patent_res_b = patent_service.to_patent_result(raw_b, similarity_score)

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    response = PatentComparisonResponse(
        patent_a=patent_res_a,
        patent_b=patent_res_b,
        similarity_percentage=sim_pct,
        parameters_table=parameters_table,
        similarities=ai_analysis["similarities"],
        differences=ai_analysis["differences"],
        common_features=ai_analysis["common_features"],
        unique_features_a=ai_analysis["unique_features_a"],
        unique_features_b=ai_analysis["unique_features_b"],
        methodology_comparison=ai_analysis["methodology_comparison"],
        claims_comparison=ai_analysis["claims_comparison"],
        technical_advantages_a=ai_analysis["technical_advantages_a"],
        technical_advantages_b=ai_analysis["technical_advantages_b"],
        summary=ai_analysis["summary"],
        processing_time_ms=round(elapsed_ms, 2),
    )

    # Persist to Firestore
    save_comparison_history(user_id, response)

    return response


def save_comparison_history(user_id: str, comparison: PatentComparisonResponse) -> None:
    """Persist comparison entry to Firestore."""
    entry_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)
    data = {
        "id": entry_id,
        "user_id": user_id,
        "patent_a_id": comparison.patent_a.id,
        "patent_a_title": comparison.patent_a.title,
        "patent_b_id": comparison.patent_b.id,
        "patent_b_title": comparison.patent_b.title,
        "similarity_percentage": comparison.similarity_percentage,
        "created_at": now,
    }

    db = _get_db()
    if db is not None:
        try:
            db.collection(COLLECTION_NAME).document(entry_id).set(data, timeout=5.0)
            logger.info("[COMPARE] Persisted comparison %s for user %s", entry_id, user_id)
        except Exception as exc:
            logger.warning("[COMPARE] Firestore save failed: %s", exc)
            _in_memory_comparisons[entry_id] = data
    else:
        _in_memory_comparisons[entry_id] = data


def get_user_comparison_history(user_id: str, limit: int = 20) -> list[ComparisonHistoryEntry]:
    """Retrieve comparison history for user."""
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
            logger.warning("[COMPARE] Firestore history fetch failed: %s", exc)

    for d in _in_memory_comparisons.values():
        if d.get("user_id") == user_id and not any(r.get("id") == d.get("id") for r in raw_docs):
            raw_docs.append(d)

    entries: list[ComparisonHistoryEntry] = []
    for d in raw_docs:
        c_at = d.get("created_at")
        if hasattr(c_at, "datetime"):
            c_at = c_at.datetime().replace(tzinfo=timezone.utc)
        elif not isinstance(c_at, datetime):
            c_at = datetime.now(tz=timezone.utc)

        entries.append(
            ComparisonHistoryEntry(
                id=str(d.get("id", "")),
                user_id=str(d.get("user_id", user_id)),
                patent_a_id=str(d.get("patent_a_id", "")),
                patent_a_title=str(d.get("patent_a_title", "")),
                patent_b_id=str(d.get("patent_b_id", "")),
                patent_b_title=str(d.get("patent_b_title", "")),
                similarity_percentage=float(d.get("similarity_percentage", 0.0)),
                created_at=c_at,
            )
        )

    entries.sort(key=lambda x: x.created_at, reverse=True)
    return entries[:limit]


def delete_comparison_history_entry(entry_id: str, user_id: str) -> bool:
    """Delete a comparison history entry."""
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
            logger.warning("[COMPARE] Failed to delete Firestore doc %s: %s", entry_id, exc)

    if entry_id in _in_memory_comparisons and _in_memory_comparisons[entry_id].get("user_id") == user_id:
        del _in_memory_comparisons[entry_id]
        deleted = True

    return deleted
