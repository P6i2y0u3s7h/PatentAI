"""
PDF extraction service using pypdf.
Validates file type, size, and extracts text from all pages.
"""

import io
import logging

from app.config import get_settings
from app.core.exceptions import FileTooLargeError, PDFExtractionError, UnsupportedFileTypeError

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes, filename: str = "") -> str:
    """
    Extract plain text from a PDF file.

    Args:
        file_bytes: Raw bytes of the uploaded PDF.
        filename: Original filename for validation.

    Returns:
        Extracted text string.

    Raises:
        UnsupportedFileTypeError: If the file is not a PDF.
        FileTooLargeError: If the file exceeds the configured size limit.
        PDFExtractionError: If text extraction fails.
    """
    settings = get_settings()

    # ── Type validation ────────────────────────────────────────────────────────
    if filename and not filename.lower().endswith(".pdf"):
        raise UnsupportedFileTypeError()

    # Check PDF magic bytes: %PDF
    if not file_bytes.startswith(b"%PDF"):
        raise UnsupportedFileTypeError()

    # ── Size validation ────────────────────────────────────────────────────────
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > settings.MAX_PDF_SIZE_MB:
        raise FileTooLargeError(settings.MAX_PDF_SIZE_MB)

    # ── Extraction ────────────────────────────────────────────────────────────
    try:
        from pypdf import PdfReader  # lazy import

        reader = PdfReader(io.BytesIO(file_bytes))

        if len(reader.pages) == 0:
            raise PDFExtractionError("The PDF has no pages.")

        pages_text: list[str] = []
        for page_num, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
                pages_text.append(text)
            except Exception as page_exc:
                logger.warning("Could not extract text from page %d: %s", page_num + 1, page_exc)

        full_text = "\n\n".join(filter(None, pages_text))

        if not full_text.strip():
            raise PDFExtractionError(
                "No text could be extracted. The PDF may be scanned or image-only."
            )

        logger.info(
            "Extracted %d characters from PDF '%s' (%d pages).",
            len(full_text),
            filename or "unknown",
            len(reader.pages),
        )
        return full_text

    except (FileTooLargeError, UnsupportedFileTypeError, PDFExtractionError):
        raise
    except Exception as exc:
        logger.error("PDF extraction error: %s", exc)
        raise PDFExtractionError(str(exc)) from exc
