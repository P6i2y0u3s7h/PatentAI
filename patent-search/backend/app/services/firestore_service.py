"""
Firestore & SQLite Hybrid Service: CRUD operations for search history.
Ensures history and analytics always work reliably even when Firebase Admin service
account credentials are not yet configured in cloud environments.
"""

import json
import logging
from pathlib import Path
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.firebase_admin_init import get_firebase_available
from app.models import HistoryEntry

logger = logging.getLogger(__name__)

COLLECTION_NAME = "search_history"
RESEARCH_COLLECTION = "research_history"
DRAFT_REVIEWS_COLLECTION = "draft_reviews"
PATENT_NETWORKS_COLLECTION = "patent_networks"
CLAIM_CHARTS_COLLECTION = "claim_charts"
SQLITE_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "search_history.db"
_db_lock = threading.Lock()


def _init_sqlite() -> None:
    """Ensure all history and analysis tables exist in local SQLite database."""
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

            conn.execute("""
                CREATE TABLE IF NOT EXISTS research_history (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    invention_title TEXT NOT NULL,
                    technical_field TEXT,
                    query_count INTEGER DEFAULT 0,
                    patents_found INTEGER DEFAULT 0,
                    top_similarity REAL DEFAULT 0.0,
                    created_at TEXT NOT NULL,
                    summary TEXT,
                    full_data_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_res_user_id ON research_history(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_res_created_at ON research_history(created_at)")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS draft_reviews (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    technical_field TEXT,
                    review_type TEXT,
                    quality_score REAL DEFAULT 0.0,
                    issue_count INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    full_data_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_dr_user_id ON draft_reviews(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_dr_created_at ON draft_reviews(created_at)")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS patent_networks (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    central_patent_id TEXT NOT NULL,
                    central_title TEXT NOT NULL,
                    node_count INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    full_data_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pn_user_id ON patent_networks(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pn_created_at ON patent_networks(created_at)")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS claim_charts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    doc_a_name TEXT,
                    doc_b_name TEXT,
                    coverage_score REAL DEFAULT 0.0,
                    total_elements INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    full_data_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cc_user_id ON claim_charts(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cc_created_at ON claim_charts(created_at)")
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


# ── AI Patent Research Agent Persistence ────────────────────────────────────

RESEARCH_COLLECTION = "research_history"


def save_research_history(
    user_id: str,
    task_id: str,
    invention_title: str,
    technical_field: str | None,
    query_count: int,
    patents_found: int,
    top_similarity: float,
    summary: str,
    full_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Save an AI Patent Research report to SQLite and Firestore.
    """
    now = datetime.now(tz=timezone.utc).isoformat()
    raw_json = json.dumps(full_data, ensure_ascii=False)

    record = {
        "id": task_id,
        "user_id": user_id,
        "invention_title": invention_title,
        "technical_field": technical_field or "General Technology",
        "query_count": query_count,
        "patents_found": patents_found,
        "top_similarity": top_similarity,
        "created_at": now,
        "summary": summary,
        "full_data": full_data,
    }

    # 1. SQLite storage
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO research_history
                (id, user_id, invention_title, technical_field, query_count, patents_found, top_similarity, created_at, summary, full_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    user_id,
                    invention_title,
                    technical_field or "General Technology",
                    query_count,
                    patents_found,
                    top_similarity,
                    now,
                    summary,
                    raw_json,
                ),
            )
        logger.info("[RESEARCH] Saved research task '%s' to SQLite for '%s'.", task_id, user_id)
    except Exception as sq_err:
        logger.error("[RESEARCH] SQLite write error: %s", sq_err)

    # 2. Firestore storage
    db = _get_firestore_client()
    if db is not None:
        try:
            db.collection(RESEARCH_COLLECTION).document(task_id).set({
                "user_id": user_id,
                "invention_title": invention_title,
                "technical_field": technical_field or "General Technology",
                "query_count": query_count,
                "patents_found": patents_found,
                "top_similarity": top_similarity,
                "created_at": now,
                "summary": summary,
                "full_data_json": raw_json,
            })
            logger.info("[RESEARCH] Synced research task '%s' to Firestore.", task_id)
        except Exception as fs_err:
            logger.warning("[RESEARCH] Firestore sync failed: %s", fs_err)

    return record


def get_research_history(user_id: str, limit: int = 30) -> list[dict[str, Any]]:
    """
    Retrieve research history for a user, sorted descending by created_at.
    """
    db = _get_firestore_client()
    if db is not None:
        try:
            raw_docs = []
            try:
                query = (
                    db.collection(RESEARCH_COLLECTION)
                    .where("user_id", "==", user_id)
                    .order_by("created_at", direction="DESCENDING")
                    .limit(limit)
                )
                raw_docs = list(query.stream())
            except Exception:
                # If composite index is pending/missing in Firestore, query without order_by and sort in memory
                query = (
                    db.collection(RESEARCH_COLLECTION)
                    .where("user_id", "==", user_id)
                    .limit(limit)
                )
                raw_docs = list(query.stream())

            results = []
            for d in raw_docs:
                data = d.to_dict()
                data["id"] = d.id
                if "full_data_json" in data and not data.get("full_data"):
                    try:
                        data["full_data"] = json.loads(data["full_data_json"])
                    except Exception:
                        data["full_data"] = {}
                results.append(data)
            if results:
                results.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
                return results[:limit]
        except Exception as fs_err:
            logger.warning("[RESEARCH] Firestore read error: %s. Falling back to SQLite.", fs_err)

    # SQLite fallback
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, user_id, invention_title, technical_field, query_count, patents_found,
                       top_similarity, created_at, summary, full_data_json
                FROM research_history
                WHERE user_id = ? OR user_id = 'dev-user'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
            rows = cursor.fetchall()
            entries = []
            for r in rows:
                full_data = {}
                if r["full_data_json"]:
                    try:
                        full_data = json.loads(r["full_data_json"])
                    except Exception:
                        pass

                entries.append({
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "invention_title": r["invention_title"],
                    "technical_field": r["technical_field"],
                    "query_count": r["query_count"] or 0,
                    "patents_found": r["patents_found"] or 0,
                    "top_similarity": r["top_similarity"] or 0.0,
                    "created_at": r["created_at"],
                    "summary": r["summary"] or "",
                    "full_data": full_data,
                })
            return entries
    except Exception as sq_err:
        logger.error("[RESEARCH] SQLite read error: %s", sq_err)
        return []


def get_research_by_id(task_id: str, user_id: str) -> dict[str, Any] | None:
    """Retrieve full research report data by task_id."""
    # 1. SQLite
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, user_id, invention_title, technical_field, query_count, patents_found,
                       top_similarity, created_at, summary, full_data_json
                FROM research_history
                WHERE id = ? AND (user_id = ? OR user_id = 'dev-user')
                """,
                (task_id, user_id),
            )
            row = cursor.fetchone()
            if row:
                full_data = {}
                if row["full_data_json"]:
                    try:
                        full_data = json.loads(row["full_data_json"])
                    except Exception:
                        pass
                return {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "invention_title": row["invention_title"],
                    "technical_field": row["technical_field"],
                    "query_count": row["query_count"] or 0,
                    "patents_found": row["patents_found"] or 0,
                    "top_similarity": row["top_similarity"] or 0.0,
                    "created_at": row["created_at"],
                    "summary": row["summary"] or "",
                    "full_data": full_data,
                }
    except Exception as sq_err:
        logger.warning("[RESEARCH] SQLite query error: %s", sq_err)

    # 2. Firestore
    db = _get_firestore_client()
    if db is not None:
        try:
            doc = db.collection(RESEARCH_COLLECTION).document(task_id).get()
            if doc.exists:
                data = doc.to_dict() or {}
                data["id"] = doc.id
                if "full_data_json" in data and not data.get("full_data"):
                    try:
                        data["full_data"] = json.loads(data["full_data_json"])
                    except Exception:
                        data["full_data"] = {}
                return data
        except Exception as fs_err:
            logger.warning("[RESEARCH] Firestore query error: %s", fs_err)

    return None


def delete_research_history(task_id: str, user_id: str) -> bool:
    """Delete a research history entry."""
    deleted = False
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            cur = conn.execute(
                "DELETE FROM research_history WHERE id = ? AND (user_id = ? OR user_id = 'dev-user')",
                (task_id, user_id),
            )
            if cur.rowcount > 0:
                deleted = True
    except Exception as sq_err:
        logger.warning("[RESEARCH] SQLite delete error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(RESEARCH_COLLECTION).document(task_id)
            if doc_ref.get().exists:
                doc_ref.delete()
                deleted = True
        except Exception as fs_err:
            logger.warning("[RESEARCH] Firestore delete error: %s", fs_err)

    return deleted


# ── 1. Draft Reviews Persistence ──────────────────────────────────────────────


def save_draft_review(data: dict) -> str:
    """Save a patent draft review to SQLite and Cloud Firestore."""
    review_id = data.get("id") or f"rev_{uuid.uuid4().hex[:12]}"
    user_id = data.get("user_id") or "anonymous"
    title = data.get("title", "Untitled Draft Review")
    tech_field = data.get("technical_field", "")
    review_type = data.get("review_type", "Comprehensive Review")
    quality_score = float(data.get("quality_score", 0.0))
    issue_count = len(data.get("issues", []))
    created_at = data.get("created_at") or datetime.now(timezone.utc).isoformat()
    full_data_json = json.dumps(data, default=str)

    # 1. SQLite
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO draft_reviews
                (id, user_id, title, technical_field, review_type, quality_score, issue_count, created_at, full_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (review_id, user_id, title, tech_field, review_type, quality_score, issue_count, created_at, full_data_json),
            )
    except Exception as sq_err:
        logger.warning("[DRAFT_REVIEW] SQLite save error: %s", sq_err)

    # 2. Firestore
    db = _get_firestore_client()
    if db is not None:
        try:
            db.collection(DRAFT_REVIEWS_COLLECTION).document(review_id).set({
                "id": review_id,
                "user_id": user_id,
                "title": title,
                "technical_field": tech_field,
                "review_type": review_type,
                "quality_score": quality_score,
                "issue_count": issue_count,
                "created_at": created_at,
                "full_data_json": full_data_json,
            })
        except Exception as fs_err:
            logger.warning("[DRAFT_REVIEW] Firestore save error: %s", fs_err)

    return review_id


def get_draft_review_by_id(review_id: str, user_id: str) -> Optional[dict]:
    """Retrieve full draft review data by ID."""
    # 1. SQLite
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT full_data_json FROM draft_reviews WHERE id = ? AND (user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous')",
                (review_id, user_id, user_id),
            )
            row = cursor.fetchone()
            if row and row["full_data_json"]:
                return json.loads(row["full_data_json"])
    except Exception as sq_err:
        logger.warning("[DRAFT_REVIEW] SQLite read error: %s", sq_err)

    # 2. Firestore
    db = _get_firestore_client()
    if db is not None:
        try:
            doc = db.collection(DRAFT_REVIEWS_COLLECTION).document(review_id).get()
            if doc.exists:
                d = doc.to_dict() or {}
                if "full_data_json" in d:
                    return json.loads(d["full_data_json"])
                return d
        except Exception as fs_err:
            logger.warning("[DRAFT_REVIEW] Firestore read error: %s", fs_err)

    return None


def get_draft_reviews_by_user(user_id: str, limit: int = 30) -> list[dict]:
    """Retrieve review history for a user."""
    items: list[dict] = []
    # 1. SQLite
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, user_id, title, technical_field, quality_score, issue_count, created_at
                FROM draft_reviews
                WHERE user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, user_id, limit),
            )
            for r in cursor.fetchall():
                items.append({
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "title": r["title"],
                    "technical_field": r["technical_field"] or "",
                    "quality_score": float(r["quality_score"] or 0.0),
                    "issue_count": int(r["issue_count"] or 0),
                    "created_at": r["created_at"],
                })
        if items:
            return items
    except Exception as sq_err:
        logger.warning("[DRAFT_REVIEW] SQLite history error: %s", sq_err)

    # 2. Firestore fallback
    db = _get_firestore_client()
    if db is not None:
        try:
            docs = (
                db.collection(DRAFT_REVIEWS_COLLECTION)
                .where("user_id", "==", user_id)
                .limit(limit)
                .stream()
            )
            for doc in docs:
                d = doc.to_dict() or {}
                items.append({
                    "id": doc.id,
                    "user_id": d.get("user_id", user_id),
                    "title": d.get("title", "Untitled Review"),
                    "technical_field": d.get("technical_field", ""),
                    "quality_score": float(d.get("quality_score", 0.0)),
                    "issue_count": int(d.get("issue_count", 0)),
                    "created_at": str(d.get("created_at", "")),
                })
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        except Exception as fs_err:
            logger.warning("[DRAFT_REVIEW] Firestore history error: %s", fs_err)

    return items


def delete_draft_review(review_id: str, user_id: str) -> bool:
    """Delete a draft review entry."""
    deleted = False
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            cur = conn.execute("DELETE FROM draft_reviews WHERE id = ? AND (user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous')", (review_id, user_id, user_id))
            if cur.rowcount > 0:
                deleted = True
    except Exception as sq_err:
        logger.warning("[DRAFT_REVIEW] SQLite delete error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(DRAFT_REVIEWS_COLLECTION).document(review_id)
            if doc_ref.get().exists:
                doc_ref.delete()
                deleted = True
        except Exception as fs_err:
            logger.warning("[DRAFT_REVIEW] Firestore delete error: %s", fs_err)

    return deleted


# ── 2. Patent Similarity Networks Persistence ─────────────────────────────────


def save_patent_network(data: dict) -> str:
    """Save a patent similarity network to SQLite and Cloud Firestore."""
    net_id = data.get("id") or f"net_{uuid.uuid4().hex[:12]}"
    user_id = data.get("user_id") or "anonymous"
    central_id = data.get("central_patent_id", "")
    central_title = data.get("central_title", "")
    node_count = len(data.get("nodes", []))
    created_at = data.get("created_at") or datetime.now(timezone.utc).isoformat()
    full_data_json = json.dumps(data, default=str)

    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO patent_networks
                (id, user_id, central_patent_id, central_title, node_count, created_at, full_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (net_id, user_id, central_id, central_title, node_count, created_at, full_data_json),
            )
    except Exception as sq_err:
        logger.warning("[PATENT_NETWORK] SQLite save error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            db.collection(PATENT_NETWORKS_COLLECTION).document(net_id).set({
                "id": net_id,
                "user_id": user_id,
                "central_patent_id": central_id,
                "central_title": central_title,
                "node_count": node_count,
                "created_at": created_at,
                "full_data_json": full_data_json,
            })
        except Exception as fs_err:
            logger.warning("[PATENT_NETWORK] Firestore save error: %s", fs_err)

    return net_id


def get_patent_network_by_id(net_id: str, user_id: str) -> Optional[dict]:
    """Retrieve full patent network data by ID."""
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT full_data_json FROM patent_networks WHERE id = ? AND (user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous')",
                (net_id, user_id, user_id),
            )
            row = cursor.fetchone()
            if row and row["full_data_json"]:
                return json.loads(row["full_data_json"])
    except Exception as sq_err:
        logger.warning("[PATENT_NETWORK] SQLite read error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            doc = db.collection(PATENT_NETWORKS_COLLECTION).document(net_id).get()
            if doc.exists:
                d = doc.to_dict() or {}
                if "full_data_json" in d:
                    return json.loads(d["full_data_json"])
                return d
        except Exception as fs_err:
            logger.warning("[PATENT_NETWORK] Firestore read error: %s", fs_err)

    return None


def get_patent_networks_by_user(user_id: str, limit: int = 30) -> list[dict]:
    """Retrieve patent networks history for a user."""
    items: list[dict] = []
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, user_id, central_patent_id, central_title, node_count, created_at
                FROM patent_networks
                WHERE user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, user_id, limit),
            )
            for r in cursor.fetchall():
                items.append({
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "central_patent_id": r["central_patent_id"],
                    "central_title": r["central_title"],
                    "node_count": int(r["node_count"] or 0),
                    "created_at": r["created_at"],
                })
        if items:
            return items
    except Exception as sq_err:
        logger.warning("[PATENT_NETWORK] SQLite history error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            docs = (
                db.collection(PATENT_NETWORKS_COLLECTION)
                .where("user_id", "==", user_id)
                .limit(limit)
                .stream()
            )
            for doc in docs:
                d = doc.to_dict() or {}
                items.append({
                    "id": doc.id,
                    "user_id": d.get("user_id", user_id),
                    "central_patent_id": d.get("central_patent_id", ""),
                    "central_title": d.get("central_title", "Central Patent"),
                    "node_count": int(d.get("node_count", 0)),
                    "created_at": str(d.get("created_at", "")),
                })
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        except Exception as fs_err:
            logger.warning("[PATENT_NETWORK] Firestore history error: %s", fs_err)

    return items


def delete_patent_network(net_id: str, user_id: str) -> bool:
    """Delete a patent network entry."""
    deleted = False
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            cur = conn.execute("DELETE FROM patent_networks WHERE id = ? AND (user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous')", (net_id, user_id, user_id))
            if cur.rowcount > 0:
                deleted = True
    except Exception as sq_err:
        logger.warning("[PATENT_NETWORK] SQLite delete error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(PATENT_NETWORKS_COLLECTION).document(net_id)
            if doc_ref.get().exists:
                doc_ref.delete()
                deleted = True
        except Exception as fs_err:
            logger.warning("[PATENT_NETWORK] Firestore delete error: %s", fs_err)

    return deleted


# ── 3. Claim Charts Persistence ───────────────────────────────────────────────


def save_claim_chart(data: dict) -> str:
    """Save an AI Claim Chart to SQLite and Cloud Firestore."""
    chart_id = data.get("id") or f"chart_{uuid.uuid4().hex[:12]}"
    user_id = data.get("user_id") or "anonymous"
    title = data.get("title", "Patent Claim Chart")
    doc_a_name = data.get("doc_a_name", "Document A")
    doc_b_name = data.get("doc_b_name", "Document B")
    coverage_score = float(data.get("coverage_score", 0.0))
    total_elements = len(data.get("elements", []))
    created_at = data.get("created_at") or datetime.now(timezone.utc).isoformat()
    full_data_json = json.dumps(data, default=str)

    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO claim_charts
                (id, user_id, title, doc_a_name, doc_b_name, coverage_score, total_elements, created_at, full_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (chart_id, user_id, title, doc_a_name, doc_b_name, coverage_score, total_elements, created_at, full_data_json),
            )
    except Exception as sq_err:
        logger.warning("[CLAIM_CHART] SQLite save error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            db.collection(CLAIM_CHARTS_COLLECTION).document(chart_id).set({
                "id": chart_id,
                "user_id": user_id,
                "title": title,
                "doc_a_name": doc_a_name,
                "doc_b_name": doc_b_name,
                "coverage_score": coverage_score,
                "total_elements": total_elements,
                "created_at": created_at,
                "full_data_json": full_data_json,
            })
        except Exception as fs_err:
            logger.warning("[CLAIM_CHART] Firestore save error: %s", fs_err)

    return chart_id


def get_claim_chart_by_id(chart_id: str, user_id: str) -> Optional[dict]:
    """Retrieve full claim chart data by ID."""
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT full_data_json FROM claim_charts WHERE id = ? AND (user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous')",
                (chart_id, user_id, user_id),
            )
            row = cursor.fetchone()
            if row and row["full_data_json"]:
                return json.loads(row["full_data_json"])
    except Exception as sq_err:
        logger.warning("[CLAIM_CHART] SQLite read error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            doc = db.collection(CLAIM_CHARTS_COLLECTION).document(chart_id).get()
            if doc.exists:
                d = doc.to_dict() or {}
                if "full_data_json" in d:
                    return json.loads(d["full_data_json"])
                return d
        except Exception as fs_err:
            logger.warning("[CLAIM_CHART] Firestore read error: %s", fs_err)

    return None


def get_claim_charts_by_user(user_id: str, limit: int = 30) -> list[dict]:
    """Retrieve claim charts history for a user."""
    items: list[dict] = []
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, user_id, title, doc_a_name, doc_b_name, coverage_score, total_elements, created_at
                FROM claim_charts
                WHERE user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, user_id, limit),
            )
            for r in cursor.fetchall():
                items.append({
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "title": r["title"],
                    "doc_a_name": r["doc_a_name"] or "",
                    "doc_b_name": r["doc_b_name"] or "",
                    "coverage_score": float(r["coverage_score"] or 0.0),
                    "total_elements": int(r["total_elements"] or 0),
                    "created_at": r["created_at"],
                })
        if items:
            return items
    except Exception as sq_err:
        logger.warning("[CLAIM_CHART] SQLite history error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            docs = (
                db.collection(CLAIM_CHARTS_COLLECTION)
                .where("user_id", "==", user_id)
                .limit(limit)
                .stream()
            )
            for doc in docs:
                d = doc.to_dict() or {}
                items.append({
                    "id": doc.id,
                    "user_id": d.get("user_id", user_id),
                    "title": d.get("title", "Patent Claim Chart"),
                    "doc_a_name": d.get("doc_a_name", ""),
                    "doc_b_name": d.get("doc_b_name", ""),
                    "coverage_score": float(d.get("coverage_score", 0.0)),
                    "total_elements": int(d.get("total_elements", 0)),
                    "created_at": str(d.get("created_at", "")),
                })
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        except Exception as fs_err:
            logger.warning("[CLAIM_CHART] Firestore history error: %s", fs_err)

    return items


def delete_claim_chart(chart_id: str, user_id: str) -> bool:
    """Delete a claim chart entry."""
    deleted = False
    try:
        with _db_lock, sqlite3.connect(str(SQLITE_DB_PATH)) as conn:
            cur = conn.execute("DELETE FROM claim_charts WHERE id = ? AND (user_id = ? OR user_id = 'dev-user' OR ? = 'anonymous')", (chart_id, user_id, user_id))
            if cur.rowcount > 0:
                deleted = True
    except Exception as sq_err:
        logger.warning("[CLAIM_CHART] SQLite delete error: %s", sq_err)

    db = _get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection(CLAIM_CHARTS_COLLECTION).document(chart_id)
            if doc_ref.get().exists:
                doc_ref.delete()
                deleted = True
        except Exception as fs_err:
            logger.warning("[CLAIM_CHART] Firestore delete error: %s", fs_err)

    return deleted

