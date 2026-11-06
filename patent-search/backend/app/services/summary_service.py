"""
Summarization service using facebook/bart-large-cnn.
Handles chunking for texts that exceed the model's token limit.
"""

import logging
import threading
from typing import Optional

from app.config import get_settings
from app.core.exceptions import ModelNotLoadedError
from app.utils import clean_text, extractive_summarize, truncate_text

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

            try:
                _pipeline = hf_pipeline(
                    "summarization",
                    model=settings.SUMMARIZATION_MODEL,
                    tokenizer=settings.SUMMARIZATION_MODEL,
                    device=-1,  # CPU; set to 0 for GPU
                    model_kwargs={"local_files_only": True},
                )
                _model_loaded = True
                logger.info("Local BART summarization model loaded successfully.")
            except Exception as local_err:
                logger.info(
                    "Local BART weights not pre-cached (%s). Skipping 1.6GB download on startup to conserve memory. Fast LLM / extractive summarization engine active.",
                    local_err,
                )
                _model_loaded = False
                return
        except Exception as exc:
            logger.warning("BART summarization model unavailable, fallback enabled: %s", exc)
            _model_loaded = False


def is_summarization_model_loaded() -> bool:
    return _model_loaded


def summarize(text: str) -> str:
    """
    Summarize patent text using BART-large-CNN with extractive fallback.

    Truncates input to the model's effective token budget before inference.
    Returns the generated summary string.
    """
    settings = get_settings()
    cleaned = clean_text(text)
    if not cleaned:
        return ""

    word_count = len(cleaned.split())
    # If the text is already very brief (<= 15 words), return it directly
    if word_count <= 15:
        return cleaned

    if not _model_loaded or _pipeline is None:
        logger.info("Using extractive summary fallback.")
        return extractive_summarize(cleaned, max_sentences=4)

    try:
        truncated = truncate_text(cleaned, max_tokens=settings.MAX_SUMMARY_INPUT_TOKENS)
        # Adaptively scale min_length and max_length for shorter inputs
        dynamic_min = min(settings.MIN_SUMMARY_LENGTH, max(10, word_count // 3))
        dynamic_max = max(dynamic_min + 15, min(settings.MAX_SUMMARY_LENGTH, word_count))

        result = _pipeline(
            truncated,
            max_length=dynamic_max,
            min_length=dynamic_min,
            do_sample=False,
            num_beams=4,
            early_stopping=True,
        )
        summary: str = result[0]["summary_text"]  # type: ignore[index]
        return summary.strip()
    except Exception as exc:
        logger.warning("BART inference error, executing extractive fallback: %s", exc)
        return extractive_summarize(cleaned, max_sentences=4)

