"""
Firebase Admin SDK initialization.
Initializes once on first import and reuses the same app instance safely across all threads.
"""

import base64
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

import firebase_admin
from firebase_admin import credentials

logger = logging.getLogger(__name__)

_firebase_app: Optional[firebase_admin.App] = None
_firebase_available: bool = False


def _normalize_service_account_dict(data: dict[str, Any]) -> dict[str, Any]:
    """
    Ensure service account fields (especially private_key with escaped newlines)
    are parsed into valid formats accepted by credentials.Certificate.
    """
    if "private_key" in data and isinstance(data["private_key"], str):
        # Cloud platforms (Railway, Render, Vercel) often store multiline env vars with literal \n
        if "\\n" in data["private_key"]:
            data["private_key"] = data["private_key"].replace("\\n", "\n")
    return data


def initialize_firebase() -> bool:
    """
    Initialize Firebase Admin SDK from environment variable, file, or default credentials.
    Returns True if successful, False if credentials are missing (non-fatal).
    """
    global _firebase_app, _firebase_available

    # Re-use existing app if already initialized
    if _firebase_app is not None and _firebase_available:
        return True

    if firebase_admin._apps:
        try:
            _firebase_app = firebase_admin.get_app()
            _firebase_available = True
            return True
        except Exception:
            pass

    sa_data: Optional[dict[str, Any]] = None

    # 1. Try reading from environment variable JSON (standard on cloud platforms like Railway/Render)
    sa_env = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        or os.getenv("FIREBASE_CREDENTIALS_JSON")
        or os.getenv("FIREBASE_ADMIN_CREDENTIALS")
    )
    if sa_env and sa_env.strip():
        raw_str = sa_env.strip()
        # Strip enclosing single/double quotes if added by shell or env manager
        if (raw_str.startswith("'") and raw_str.endswith("'")) or (raw_str.startswith('"') and raw_str.endswith('"')):
            raw_str = raw_str[1:-1].strip()

        # Check if it is a file path pointing to JSON
        if raw_str.endswith(".json") and Path(raw_str).exists():
            try:
                sa_data = json.loads(Path(raw_str).read_text(encoding="utf-8"))
                logger.info("[FIREBASE] Loaded service account from file path in environment: %s", raw_str)
            except Exception as exc:
                logger.warning("[FIREBASE] Failed reading service account from path '%s': %s", raw_str, exc)
        else:
            try:
                sa_data = json.loads(raw_str)
                logger.info("[FIREBASE] Loaded service account JSON from environment variable.")
            except Exception as exc:
                logger.warning("[FIREBASE] Failed parsing service account JSON from environment: %s", exc)

    # 2. Try reading from base64-encoded environment variable (safe for single-line pasting)
    if not sa_data and os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64"):
        try:
            raw_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64", "").strip()
            decoded = base64.b64decode(raw_b64).decode("utf-8")
            sa_data = json.loads(decoded)
            logger.info("[FIREBASE] Loaded service account JSON from base64 environment variable.")
        except Exception as exc:
            logger.warning("[FIREBASE] Failed parsing base64 service account: %s", exc)

    # 3. Try reading from local file path or standard credential location
    if not sa_data:
        search_paths = [
            os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json"),
            "firebase-service-account.json",
            "../firebase-service-account.json",
            str(Path(__file__).resolve().parent.parent / "firebase-service-account.json"),
        ]
        for p in search_paths:
            f = Path(p)
            if f.exists() and f.is_file():
                try:
                    sa_data = json.loads(f.read_text(encoding="utf-8"))
                    logger.info("[FIREBASE] Found service account file at '%s'.", p)
                    break
                except Exception as exc:
                    logger.warning("[FIREBASE] Failed reading service account file '%s': %s", p, exc)

    # 4. Check GOOGLE_APPLICATION_CREDENTIALS
    if not sa_data and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        gac = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        if Path(gac).exists():
            try:
                sa_data = json.loads(Path(gac).read_text(encoding="utf-8"))
                logger.info("[FIREBASE] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS: %s", gac)
            except Exception as exc:
                logger.warning("[FIREBASE] Failed reading GOOGLE_APPLICATION_CREDENTIALS: %s", exc)

    if not sa_data:
        logger.info(
            "[FIREBASE] Cloud service account credentials not detected in environment. "
            "High-reliability local SQLite history storage and JWT UID extraction are active. "
            "(To sync directly with Cloud Firestore, set FIREBASE_SERVICE_ACCOUNT_JSON in your cloud dashboard)."
        )
        _firebase_available = False
        return False

    try:
        sa_data = _normalize_service_account_dict(sa_data)
        cred = credentials.Certificate(sa_data)
        _firebase_app = firebase_admin.initialize_app(cred)
        _firebase_available = True
        logger.info(
            "[FIREBASE] Firebase Admin SDK initialized successfully! "
            "Project: '%s' | Service Account: '%s'",
            sa_data.get("project_id", "unknown"),
            sa_data.get("client_email", "unknown"),
        )
        return True
    except Exception as exc:
        logger.error(
            "[FIREBASE] Failed to initialize Firebase Admin SDK with provided credentials: %s. "
            "Local history fallback active.",
            exc,
        )
        _firebase_available = False
        return False


def get_firebase_available() -> bool:
    """Return whether Firebase Admin SDK has been successfully initialized."""
    return _firebase_available


def get_firestore_client():
    """Return Firestore client if initialized, else None."""
    if not get_firebase_available():
        return None
    try:
        from firebase_admin import firestore
        return firestore.client()
    except Exception as exc:
        logger.warning("[FIRESTORE] Could not obtain Firestore client: %s", exc)
        return None
