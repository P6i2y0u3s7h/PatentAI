"""
PDF extraction service using pypdf.
Validates file type, size, and extracts text from all pages.
"""

import io
import logging

from app.config import get_settings
from app.core.exceptions import FileTooLargeError, PDFExtractionError, UnsupportedFileTypeError

logger = logging.getLogger(__name__)

# Minimum extracted text length to be considered "meaningful".
# PDFs with fewer than this many characters are likely scanned/image-only.
MIN_MEANINGFUL_CHARS = 100


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
        PDFExtractionError: If text extraction fails or yields insufficient text.
    """
    settings = get_settings()

    # ── Type validation ────────────────────────────────────────────────────────
    if filename and not filename.lower().endswith(".pdf"):
        logger.warning("[PDF] Rejected non-PDF file: '%s'", filename)
        raise UnsupportedFileTypeError()

    # Check PDF magic bytes: %PDF
    if not file_bytes.startswith(b"%PDF"):
        logger.warning("[PDF] File does not start with %%PDF magic bytes: '%s'", filename)
        raise UnsupportedFileTypeError()

    # ── Size validation ────────────────────────────────────────────────────────
    size_mb = len(file_bytes) / (1024 * 1024)
    logger.info("[PDF] filename='%s', size=%.2f MB", filename or "unknown", size_mb)
    if size_mb > settings.MAX_PDF_SIZE_MB:
        raise FileTooLargeError(settings.MAX_PDF_SIZE_MB)

    # ── Extraction ────────────────────────────────────────────────────────────
    try:
        from pypdf import PdfReader  # lazy import

        reader = PdfReader(io.BytesIO(file_bytes))
        page_count = len(reader.pages)

        if page_count == 0:
            raise PDFExtractionError("The PDF has no pages.")

        logger.info("[PDF] pages=%d", page_count)

        pages_text: list[str] = []
        for page_num, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
                pages_text.append(text)
            except Exception as page_exc:
                logger.warning("[PDF] Could not extract text from page %d: %s", page_num + 1, page_exc)

        full_text = "\n\n".join(filter(None, pages_text))
        char_count = len(full_text.strip())
        word_count = len(full_text.split())

        logger.info(
            "[PDF] extracted_characters=%d, extracted_words=%d, pages=%d",
            char_count,
            word_count,
            page_count,
        )

        if char_count == 0:
            raise PDFExtractionError(
                "No text could be extracted. The PDF may be scanned or image-only. "
                "Please upload a text-based PDF."
            )

        if char_count < MIN_MEANINGFUL_CHARS:
            raise PDFExtractionError(
                f"Only {char_count} characters were extracted from this PDF — not enough for a meaningful "
                f"search (minimum {MIN_MEANINGFUL_CHARS}). The document may be mostly images or very sparse text."
            )

        logger.info(
            "[PDF] Extraction successful: %d characters from '%s' (%d pages).",
            char_count,
            filename or "unknown",
            page_count,
        )
        return full_text

    except (FileTooLargeError, UnsupportedFileTypeError, PDFExtractionError):
        raise
    except Exception as exc:
        logger.error("[PDF] Unexpected extraction error: %s", exc)
        raise PDFExtractionError(str(exc)) from exc
