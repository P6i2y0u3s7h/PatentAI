"""
Auth router: Firebase token verification endpoint.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from app.firebase_admin_init import get_firebase_available
from app.models import VerifyTokenRequest, VerifyTokenResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/verify", response_model=VerifyTokenResponse, summary="Verify Firebase Token")
async def verify_token(body: VerifyTokenRequest) -> VerifyTokenResponse:
    """
    Verify a Firebase ID token and return the decoded user claims.
    Returns uid and email if the token is valid.
    """
    if not get_firebase_available():
        # Dev mode: accept any token
        logger.warning("Firebase not available — returning mock verification.")
        return VerifyTokenResponse(uid="dev-user", email="dev@patentai.local", valid=True)

    try:
        from firebase_admin import auth as firebase_auth

        decoded = firebase_auth.verify_id_token(body.token)
        return VerifyTokenResponse(
            uid=decoded["uid"],
            email=decoded.get("email"),
            valid=True,
        )
    except Exception as exc:
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
