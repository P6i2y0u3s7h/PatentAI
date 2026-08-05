"""
Dependency injection providers for FastAPI.
"""

import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as firebase_auth

from app.firebase_admin_init import get_firebase_available

logger = logging.getLogger(__name__)


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """
    Verify Firebase ID token from Authorization header.
    Returns decoded token claims dict.

    Usage:
        @router.get("/protected")
        async def endpoint(user: dict = Depends(get_current_user)):
            ...
    """
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]

    if not get_firebase_available():
        # In development without Firebase, allow any non-empty token
        logger.warning("Firebase not available — skipping token verification.")
        return {"uid": "dev-user", "email": "dev@patentai.local"}

    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
        )
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )
    except Exception as exc:
        logger.error("Token verification error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )


async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
) -> dict | None:
    """
    Same as get_current_user but returns None instead of raising if no token.
    Use for endpoints that work with or without authentication.
    """
    if authorization is None:
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
