"""
Firestore and in-memory management for AI Assistant conversations.
Stores user chat sessions and messages securely per user UID.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.exceptions import FirestoreError
from app.firebase_admin_init import get_firebase_available
from app.models import AssistantSession, ChatMessage

logger = logging.getLogger(__name__)

COLLECTION_NAME = "assistant_chats"

# In-memory storage fallback for local development without Firebase
_in_memory_chats: dict[str, dict[str, Any]] = {}


def _get_db():
    if not get_firebase_available():
        return None
    from firebase_admin import firestore
    return firestore.client()


def save_assistant_message(
    user_id: str,
    chat_id: Optional[str],
    user_message: str,
    assistant_response: str,
    sources: list[str],
    doc_name: Optional[str] = None,
    doc_context: Optional[str] = None,
) -> tuple[str, str]:
    """
    Append user and assistant messages to a chat session in Firestore.
    Creates a new chat session if chat_id is None.
    Returns (chat_id, session_title).
    """
    now = datetime.now(tz=timezone.utc)
    now_iso = now.isoformat()

    user_msg_dict = {
        "role": "user",
        "content": user_message,
        "timestamp": now_iso,
        "sources": [],
    }
    assistant_msg_dict = {
        "role": "assistant",
        "content": assistant_response,
        "timestamp": now_iso,
        "sources": sources,
    }

    db = _get_db()

    # Determine chat_id and title
    if not chat_id:
        chat_id = str(uuid.uuid4())
        # Generate title from first message
        words = user_message.split()
        title = " ".join(words[:6]) + ("…" if len(words) > 6 else "")
        if doc_name:
            title = f"{doc_name[:20]}: {title}"
        title = title[:60]
        existing_messages = []
        created_at = now
    else:
        # Load existing to preserve title & messages
        existing = get_chat_session(chat_id, user_id)
        if existing:
            title = existing.get("title", user_message[:50])
            existing_messages = existing.get("messages", [])
            created_at = existing.get("created_at", now)
        else:
            title = user_message[:50]
            existing_messages = []
            created_at = now

    updated_messages = existing_messages + [user_msg_dict, assistant_msg_dict]

    doc_data: dict[str, Any] = {
        "id": chat_id,
        "user_id": user_id,
        "title": title,
        "doc_name": doc_name,
        "doc_context": doc_context[:10000] if doc_context else None,
        "created_at": created_at,
        "updated_at": now,
        "message_count": len(updated_messages),
        "last_message": assistant_response[:120],
        "messages": updated_messages,
    }

    if db is not None:
        try:
            db.collection(COLLECTION_NAME).document(chat_id).set(doc_data, timeout=5.0)
            logger.info("[ASSISTANT] Persisted chat %s to Firestore for user %s", chat_id, user_id)
        except Exception as exc:
            logger.warning("[ASSISTANT] Firestore set failed, saving to in-memory fallback: %s", exc)
            _in_memory_chats[chat_id] = doc_data
    else:
        _in_memory_chats[chat_id] = doc_data

    return chat_id, title


def get_chat_session(chat_id: str, user_id: str) -> Optional[dict[str, Any]]:
    """Fetch complete chat session with messages if owned by user."""
    db = _get_db()
    if db is not None:
        try:
            doc = db.collection(COLLECTION_NAME).document(chat_id).get()
            if doc.exists:
                data = doc.to_dict()
                if data.get("user_id") == user_id:
                    return data
        except Exception as exc:
            logger.warning("[ASSISTANT] Firestore get failed: %s", exc)

    in_mem = _in_memory_chats.get(chat_id)
    if in_mem and in_mem.get("user_id") == user_id:
        return in_mem

    return None


def get_user_chat_sessions(user_id: str, limit: int = 30) -> list[AssistantSession]:
    """List all chat sessions for a user, sorted newest first."""
    sessions: list[AssistantSession] = []
    db = _get_db()

    raw_docs: list[dict[str, Any]] = []
    if db is not None:
        try:
            # Query by user_id
            docs = (
                db.collection(COLLECTION_NAME)
                .where("user_id", "==", user_id)
                .stream()
            )
            for d in docs:
                raw_docs.append(d.to_dict())
        except Exception as exc:
            logger.warning("[ASSISTANT] Firestore query failed: %s", exc)

    # Merge in-memory
    for d in _in_memory_chats.values():
        if d.get("user_id") == user_id and not any(r.get("id") == d.get("id") for r in raw_docs):
            raw_docs.append(d)

    for data in raw_docs:
        c_at = data.get("created_at")
        u_at = data.get("updated_at")

        if hasattr(c_at, "datetime"):
            c_at = c_at.datetime().replace(tzinfo=timezone.utc)
        elif not isinstance(c_at, datetime):
            c_at = datetime.now(tz=timezone.utc)

        if hasattr(u_at, "datetime"):
            u_at = u_at.datetime().replace(tzinfo=timezone.utc)
        elif not isinstance(u_at, datetime):
            u_at = c_at

        sessions.append(
            AssistantSession(
                id=str(data.get("id", "")),
                user_id=str(data.get("user_id", user_id)),
                title=str(data.get("title", "Untitled Chat")),
                doc_name=data.get("doc_name"),
                created_at=c_at,
                updated_at=u_at,
                message_count=int(data.get("message_count", len(data.get("messages", [])))),
                last_message=data.get("last_message"),
            )
        )

    sessions.sort(key=lambda s: s.updated_at, reverse=True)
    return sessions[:limit]


def delete_chat_session(chat_id: str, user_id: str) -> bool:
    """Delete a chat session verifying user ownership."""
    db = _get_db()
    deleted = False

    if db is not None:
        try:
            doc_ref = db.collection(COLLECTION_NAME).document(chat_id)
            doc = doc_ref.get()
            if doc.exists and doc.to_dict().get("user_id") == user_id:
                doc_ref.delete()
                deleted = True
        except Exception as exc:
            logger.warning("[ASSISTANT] Failed to delete Firestore chat %s: %s", chat_id, exc)

    if chat_id in _in_memory_chats and _in_memory_chats[chat_id].get("user_id") == user_id:
        del _in_memory_chats[chat_id]
        deleted = True

    return deleted


def rename_chat_session(chat_id: str, user_id: str, new_title: str) -> bool:
    """Rename a chat session verifying user ownership."""
    clean_title = new_title.strip()[:120]
    if not clean_title:
        return False

    db = _get_db()
    renamed = False

    if db is not None:
        try:
            doc_ref = db.collection(COLLECTION_NAME).document(chat_id)
            doc = doc_ref.get()
            if doc.exists and doc.to_dict().get("user_id") == user_id:
                doc_ref.update({
                    "title": clean_title,
                    "updated_at": datetime.now(tz=timezone.utc),
                })
                renamed = True
        except Exception as exc:
            logger.warning("[ASSISTANT] Failed to rename Firestore chat %s: %s", chat_id, exc)

    if chat_id in _in_memory_chats and _in_memory_chats[chat_id].get("user_id") == user_id:
        _in_memory_chats[chat_id]["title"] = clean_title
        _in_memory_chats[chat_id]["updated_at"] = datetime.now(tz=timezone.utc)
        renamed = True

    return renamed

