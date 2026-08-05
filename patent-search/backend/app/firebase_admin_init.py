"""
Firebase Admin SDK initialization.
Initializes once on first import and reuses the same app instance.
"""

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
    Initialize Firebase Admin SDK from service account file.
    Returns True if successful, False if credentials are missing (non-fatal).
    """
    global _firebase_app, _firebase_available

    if _firebase_app is not None:
        return _firebase_available

    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
    cred_file = Path(cred_path)

    if not cred_file.exists():
        logger.warning(
            "Firebase service account file not found at '%s'. "
            "Authentication features will be disabled.",
            cred_path,
        )
        _firebase_available = False
        return False

    try:
        cred = credentials.Certificate(str(cred_file))
        _firebase_app = firebase_admin.initialize_app(cred)
        _firebase_available = True
        logger.info("Firebase Admin SDK initialized successfully.")
        return True
    except Exception as exc:
        logger.error("Failed to initialize Firebase Admin SDK: %s", exc)
        _firebase_available = False
        return False


def get_firebase_available() -> bool:
    """Return whether Firebase has been successfully initialized."""
    return _firebase_available
