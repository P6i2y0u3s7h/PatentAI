"""
Custom exception classes and FastAPI exception handlers.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


# ── Custom Exceptions ─────────────────────────────────────────────────────────


class PatentAIException(Exception):
    """Base exception for all PatentAI errors."""

    def __init__(self, message: str, status_code: int = 500, details: Any = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class IndexNotLoadedError(PatentAIException):
    def __init__(self):
        super().__init__(
            message="FAISS index is not loaded. Run 'python scripts/build_index.py' first.",
            status_code=503,
        )


class ModelNotLoadedError(PatentAIException):
    def __init__(self, model_name: str):
        super().__init__(
            message=f"AI model '{model_name}' is not loaded. The service may still be initializing.",
            status_code=503,
        )


class PDFExtractionError(PatentAIException):
    def __init__(self, reason: str):
        super().__init__(
            message=f"Failed to extract text from PDF: {reason}",
            status_code=422,
        )


class FileTooLargeError(PatentAIException):
    def __init__(self, max_mb: int):
        super().__init__(
            message=f"Uploaded file exceeds the maximum allowed size of {max_mb} MB.",
            status_code=413,
        )


class UnsupportedFileTypeError(PatentAIException):
    def __init__(self):
        super().__init__(
            message="Only PDF files are supported for upload.",
            status_code=415,
        )


class FirebaseAuthError(PatentAIException):
    def __init__(self, reason: str = "Invalid or expired token"):
        super().__init__(message=reason, status_code=401)


class FirestoreError(PatentAIException):
    def __init__(self, reason: str):
        super().__init__(
            message=f"Database operation failed: {reason}",
            status_code=500,
        )


class RateLimitError(PatentAIException):
    def __init__(self):
        super().__init__(
            message="Too many requests. Please wait before trying again.",
            status_code=429,
        )


# ── Exception Handlers ────────────────────────────────────────────────────────


def _error_response(status_code: int, message: str, details: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"error": message, "status_code": status_code}
    if details is not None:
        body["details"] = details
    return JSONResponse(status_code=status_code, content=body)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI app."""

    @app.exception_handler(PatentAIException)
    async def handle_patentai_exception(request: Request, exc: PatentAIException) -> JSONResponse:
        logger.error("PatentAIException [%s]: %s", exc.status_code, exc.message)
        return _error_response(exc.status_code, exc.message, exc.details)

    @app.exception_handler(ValueError)
    async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
        logger.warning("Validation error: %s", exc)
        return _error_response(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    @app.exception_handler(Exception)
    async def handle_generic_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Please try again later.",
        )
