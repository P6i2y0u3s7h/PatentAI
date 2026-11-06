"""
Firestore & SQLite Hybrid Service: CRUD operations for search history.
Ensures history and analytics always work reliably even when Firebase Admin service
account credentials are not yet configured in cloud environments.
"""

import logging
from pathlib import Path
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from app.firebase_admin_init import get_firebase_available
from app.models import HistoryEntry

logger = logging.getLogger(__name__)

COLLECTION_NAME = "search_history"
SQLITE_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "search_history.db"
_db_lock = threading.Lock()


def _init_sqlite() -> None:
    """Ensure search_history table exists in local SQLite database."""
    try:
        SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS search_history (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    query_snippet TEXT,
                    top_result_title TEXT,
                    top_result_score REAL,
                    result_count INTEGER,
                    created_at TEXT NOT NULL,
                    source TEXT DEFAULT 'text'
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON search_history(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON search_history(created_at)")
    except Exception as exc:
        logger.warning("[HISTORY] SQLite initialization error: %s", exc)


_init_sqlite()


def _get_firestore_client():
    """Return Firestore client if initialized, else None."""
    if not get_firebase_available():
        return None
    try:
        from firebase_admin import firestore
        return firestore.client()
    except Exception as exc:
        logger.warning("[FIRESTORE] Could not obtain Firestore client: %s", exc)
        return None


def save_search_history(
    user_id: str,
    query_snippet: str,
    top_result_title: str | None,
    top_result_score: float | None,
    result_count: int,
    source: str = "text",
) -> HistoryEntry:
    """
    Persist a search result to SQLite and mirror to Firestore when available.
    Guarantees that history is never lost even without Firebase Admin keys.
    """
    entry_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)
    now_iso = now.isoformat()

    # 1. Local SQLite persistence (high reliability)
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO search_history 
                (id, user_id, query_snippet, top_result_title, top_result_score, result_count, created_at, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    user_id,
                    query_snippet[:500],
                    top_result_title,
                    top_result_score,
                    result_count,
                    now_iso,
                    source,
                ),
            )
        logger.info("[HISTORY] Saved entry %s to SQLite for user '%s' (source=%s).", entry_id, user_id, source)
    except Exception as sq_err:
        logger.warning("[HISTORY] SQLite save warning: %s", sq_err)

    # 2. Mirror to Cloud Firestore if credentials are provided
    db = _get_firestore_client()
    if db is not None:
        try:
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
            logger.info("[HISTORY] Mirrored entry %s to Firestore for user '%s'.", entry_id, user_id)
        except Exception as fs_err:
            logger.warning("[HISTORY] Firestore mirror skipped (%s). SQLite record preserved.", fs_err)

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


def get_search_history(user_id: str, limit: int = 50) -> list[HistoryEntry]:
    """
    Retrieve search history for a user.
    Queries Firestore first, and seamlessly falls back to SQLite.
    """
    # 1. Try Firestore first
    db = _get_firestore_client()
    if db is not None:
        try:
            raw_docs = []
            try:
                docs = (
                    db.collection(COLLECTION_NAME)
                    .where("user_id", "==", user_id)
                    .order_by("created_at", direction="DESCENDING")
                    .limit(limit)
                    .stream()
                )
                raw_docs = list(docs)
            except Exception:
                docs = (
                    db.collection(COLLECTION_NAME)
                    .where("user_id", "==", user_id)
                    .limit(limit)
                    .stream()
                )
                raw_docs = list(docs)

            if raw_docs:
                entries: list[HistoryEntry] = []
                for doc in raw_docs:
                    data = doc.to_dict()
                    created_at = data.get("created_at")
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
                entries.sort(key=lambda x: x.created_at, reverse=True)
                return entries[:limit]
        except Exception as fs_err:
            logger.warning("[HISTORY] Firestore read warning (%s) — querying SQLite.", fs_err)

    # 2. SQLite read (high reliability fallback)
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, user_id, query_snippet, top_result_title, top_result_score, result_count, created_at, source
                FROM search_history
                WHERE user_id = ? OR user_id = 'dev-user'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
            rows = cursor.fetchall()
            entries = []
            for r in rows:
                try:
                    dt = datetime.fromisoformat(r["created_at"])
                except Exception:
                    dt = datetime.now(tz=timezone.utc)

                entries.append(
                    HistoryEntry(
                        id=r["id"],
                        user_id=r["user_id"],
                        query_snippet=r["query_snippet"] or "",
                        top_result_title=r["top_result_title"],
                        top_result_score=r["top_result_score"],
                        result_count=r["result_count"] or 0,
                        created_at=dt,
                        source=r["source"] or "text",
                    )
                )
            logger.info("[HISTORY] Retrieved %d search history entries from SQLite for '%s'.", len(entries), user_id)
            return entries
    except Exception as sq_err:
        logger.error("[HISTORY] SQLite read error: %s", sq_err)
        return []


def delete_history_entry(entry_id: str, user_id: str) -> bool:
    """
    Delete a history entry from SQLite and Firestore.
    """
    deleted = False

    # 1. Delete from SQLite
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            cursor = conn.execute(
                "DELETE FROM search_history WHERE id = ? AND (user_id = ? OR user_id = 'dev-user')",
                (entry_id, user_id),
            )
            if cursor.rowcount > 0:
                deleted = True
    except Exception as sq_err:
        logger.warning("[HISTORY] SQLite delete error: %s", sq_err)

    # 2. Delete from Firestore if available
    db = _get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(COLLECTION_NAME).document(entry_id)
            doc = doc_ref.get()
            if doc.exists:
                doc_ref.delete()
                deleted = True
        except Exception as fs_err:
            logger.warning("[HISTORY] Firestore delete error: %s", fs_err)

    return deleted
