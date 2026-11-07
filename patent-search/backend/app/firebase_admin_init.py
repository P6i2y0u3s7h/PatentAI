"""
Firebase Admin SDK initialization.
Initializes once on first import and reuses the same app instance.
"""

import base64
import json
import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials

logger = logging.getLogger(__name__)

_firebase_app: firebase_admin.App | None = None
_firebase_available: bool = False


def initialize_firebase() -> bool:
    """
    Initialize Firebase Admin SDK from environment variable, file, or default credentials.
    Returns True if successful, False if credentials are missing (non-fatal).
    """
    global _firebase_app, _firebase_available

    if _firebase_app is not None:
        return _firebase_available

    sa_data: dict | None = None

    # 1. Try reading from environment variable JSON (standard on cloud platforms like Render/Railway)
    sa_env = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        or os.getenv("FIREBASE_CREDENTIALS_JSON")
        or os.getenv("FIREBASE_ADMIN_CREDENTIALS")
    )
    if sa_env and sa_env.strip():
        try:
            sa_data = json.loads(sa_env.strip())
            logger.info("[FIREBASE] Found service account JSON in environment variable.")
        except Exception as exc:
            logger.warning("[FIREBASE] Failed to parse service account JSON from environment: %s", exc)

    # 2. Try reading from base64 environment variable
    if not sa_data and os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64"):
        try:
            raw_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64", "").strip()
            decoded = base64.b64decode(raw_b64).decode("utf-8")
            sa_data = json.loads(decoded)
            logger.info("[FIREBASE] Found service account JSON in base64 environment variable.")
        except Exception as exc:
            logger.warning("[FIREBASE] Failed to parse base64 service account: %s", exc)

    # 3. Try reading from local file path
    if not sa_data:
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
        cred_file = Path(cred_path)
        if cred_file.exists():
            try:
                sa_data = json.loads(cred_file.read_text(encoding="utf-8"))
                logger.info("[FIREBASE] Found service account file at '%s'.", cred_path)
            except Exception as exc:
                logger.warning("[FIREBASE] Failed to read credentials file '%s': %s", cred_path, exc)

    if not sa_data:
        logger.info(
            "[FIREBASE] Cloud service account not configured. "
            "High-reliability local SQLite history storage and JWT UID extraction active. "
            "(To sync with Cloud Firestore, set FIREBASE_SERVICE_ACCOUNT_JSON in cloud environment variables)."
        )
        _firebase_available = False
        return False

    try:
        cred = credentials.Certificate(sa_data)
        _firebase_app = firebase_admin.initialize_app(cred)
        _firebase_available = True
        logger.info(
            "[FIREBASE] Firebase Admin SDK initialized successfully. "
            "Project: '%s', Service Account: '%s'",
            sa_data.get("project_id", "unknown"),
            sa_data.get("client_email", "unknown"),
        )
        return True
    except Exception as exc:
        logger.error(
            "[FIREBASE] Failed to initialize Firebase Admin SDK with credentials: %s. "
            "Local history fallback active.",
            exc,
        )
        _firebase_available = False
        return False


def get_firebase_available() -> bool:
    """Return whether Firebase has been successfully initialized."""
    return _firebase_available
