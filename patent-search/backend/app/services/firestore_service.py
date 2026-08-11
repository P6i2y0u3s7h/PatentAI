"""
Firestore service: CRUD operations for search history.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.exceptions import FirestoreError
from app.firebase_admin_init import get_firebase_available
from app.models import HistoryEntry

logger = logging.getLogger(__name__)

COLLECTION_NAME = "search_history"


def _get_db():
    """Return Firestore client or raise if Firebase is not initialized."""
    if not get_firebase_available():
        raise FirestoreError("Firebase is not initialized. Check your credentials.")
    from firebase_admin import firestore
    return firestore.client()


def save_search_history(
    user_id: str,
    query_snippet: str,
    top_result_title: str | None,
    top_result_score: float | None,
    result_count: int,
    source: str = "text",
) -> HistoryEntry:
    """Persist a search result to Firestore and return the created entry."""
    try:
        db = _get_db()
        entry_id = str(uuid.uuid4())
        now = datetime.now(tz=timezone.utc)

        doc_data: dict[str, Any] = {
            "id": entry_id,
            "user_id": user_id,
            "query_snippet": query_snippet[:500],
            "top_result_title": top_result_title,
            "top_result_score": top_result_score,
            "result_count": result_count,
            "created_at": now,
            "source": source,
        }

        db.collection(COLLECTION_NAME).document(entry_id).set(doc_data)
        logger.info("[HISTORY] Saved search history entry %s for user %s (source=%s).", entry_id, user_id, source)

        return HistoryEntry(
            id=entry_id,
            user_id=user_id,
            query_snippet=query_snippet[:200],
            top_result_title=top_result_title,
            top_result_score=top_result_score,
            result_count=result_count,
            created_at=now,
            source=source,
        )
    except FirestoreError:
        raise
    except Exception as exc:
        logger.error("Failed to save search history: %s", exc)
        raise FirestoreError(str(exc)) from exc


def get_search_history(user_id: str, limit: int = 50) -> list[HistoryEntry]:
    """Retrieve the most recent search history entries for a user."""
    try:
        db = _get_db()
        raw_docs = []

        try:
            # Try indexed ordered query first
            docs = (
                db.collection(COLLECTION_NAME)
                .where("user_id", "==", user_id)
                .order_by("created_at", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            raw_docs = list(docs)
        except Exception as query_exc:
            logger.warning(
                "[HISTORY] Ordered Firestore query failed (%s). Falling back to un-ordered query + in-memory sort.",
                query_exc,
            )
            docs = (
                db.collection(COLLECTION_NAME)
                .where("user_id", "==", user_id)
                .stream()
            )
            raw_docs = list(docs)

        entries: list[HistoryEntry] = []
        for doc in raw_docs:
            data = doc.to_dict()
            created_at = data.get("created_at")
            # Firestore Timestamps need conversion
            if hasattr(created_at, "datetime"):
                created_at = created_at.datetime().replace(tzinfo=timezone.utc)
            elif not isinstance(created_at, datetime):
                created_at = datetime.now(tz=timezone.utc)

            entries.append(
                HistoryEntry(
                    id=data.get("id", doc.id),
                    user_id=data.get("user_id", user_id),
                    query_snippet=data.get("query_snippet", ""),
                    top_result_title=data.get("top_result_title"),
                    top_result_score=data.get("top_result_score"),
                    result_count=data.get("result_count", 0),
                    created_at=created_at,
                    source=data.get("source", "text"),
                )
            )

        # Sort in-memory to ensure newest first regardless of index status
        entries.sort(key=lambda x: x.created_at, reverse=True)
        entries = entries[:limit]

        logger.info("[HISTORY] Retrieved %d search history entries for user '%s'.", len(entries), user_id)
        return entries
    except FirestoreError:
        raise
    except Exception as exc:
        logger.error("Failed to fetch search history: %s", exc)
        raise FirestoreError(str(exc)) from exc


def delete_history_entry(entry_id: str, user_id: str) -> bool:
    """
    Delete a history entry by ID, verifying it belongs to the requesting user.
    Returns True if deleted, False if not found.
    """
    try:
        db = _get_db()
        doc_ref = db.collection(COLLECTION_NAME).document(entry_id)
        doc = doc_ref.get()

        if not doc.exists:
            return False

        data = doc.to_dict()
        if data.get("user_id") != user_id:
            logger.warning(
                "User %s attempted to delete entry %s owned by %s.",
                user_id,
                entry_id,
                data.get("user_id"),
            )
            return False

        doc_ref.delete()
        logger.info("[HISTORY] Deleted history entry %s for user %s.", entry_id, user_id)
        return True
    except FirestoreError:
        raise
    except Exception as exc:
        logger.error("Failed to delete history entry %s: %s", entry_id, exc)
        raise FirestoreError(str(exc)) from exc
