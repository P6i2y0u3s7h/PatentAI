"""
Summarization service using facebook/bart-large-cnn.
Handles chunking for texts that exceed the model's token limit.
"""

import logging
import threading
from typing import Optional

from app.config import get_settings
from app.core.exceptions import ModelNotLoadedError
from app.utils import clean_text, truncate_text

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_pipeline = None
_model_loaded: bool = False


def load_summarization_model() -> None:
    """Load the summarization pipeline into memory. Called once at startup."""
    global _pipeline, _model_loaded
    settings = get_settings()
    with _lock:
        if _model_loaded:
            return
        logger.info("Loading summarization model: %s", settings.SUMMARIZATION_MODEL)
        try:
            from transformers import pipeline as hf_pipeline

            _pipeline = hf_pipeline(
                "summarization",
                model=settings.SUMMARIZATION_MODEL,
                tokenizer=settings.SUMMARIZATION_MODEL,
                device=-1,  # CPU; set to 0 for GPU
            )
            _model_loaded = True
            logger.info("Summarization model loaded successfully.")
        except Exception as exc:
            logger.error("Failed to load summarization model: %s", exc)
            raise


def is_summarization_model_loaded() -> bool:
    return _model_loaded


def summarize(text: str) -> str:
    """
    Summarize patent text using BART-large-CNN.

    Truncates input to the model's effective token budget before inference.
    Returns the generated summary string.
    """
    if not _model_loaded or _pipeline is None:
        raise ModelNotLoadedError("summarization")

    settings = get_settings()
    cleaned = clean_text(text)

    # Truncate to stay within BART's 1024-token limit
    truncated = truncate_text(cleaned, max_tokens=settings.MAX_SUMMARY_INPUT_TOKENS)

    result = _pipeline(
        truncated,
        max_length=settings.MAX_SUMMARY_LENGTH,
        min_length=settings.MIN_SUMMARY_LENGTH,
        do_sample=False,
        num_beams=4,
        early_stopping=True,
    )

    summary: str = result[0]["summary_text"]  # type: ignore[index]
    return summary.strip()
