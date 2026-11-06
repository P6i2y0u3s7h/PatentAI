"""
Embedding service: loads Sentence-Transformers model and generates
normalized embeddings for semantic similarity search.
"""

import logging
import threading
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import get_settings
from app.core.exceptions import ModelNotLoadedError

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_model: Optional[SentenceTransformer] = None
_model_loaded: bool = False


def load_embedding_model() -> None:
    """Load the embedding model into memory. Called once at startup."""
    global _model, _model_loaded
    settings = get_settings()
    with _lock:
        if _model_loaded:
            return
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        try:
            # Try loading cached local model first to avoid HuggingFace network retry delays
            try:
                _model = SentenceTransformer(settings.EMBEDDING_MODEL, local_files_only=True)
            except Exception:
                _model = SentenceTransformer(settings.EMBEDDING_MODEL)
            _model_loaded = True
            logger.info("Embedding model loaded successfully.")
        except Exception as exc:
            logger.error("Failed to load embedding model: %s", exc)
            raise


def is_embedding_model_loaded() -> bool:
    return _model_loaded


def get_embedding(text: str) -> np.ndarray:
    """
    Generate a single L2-normalized embedding vector.

    Args:
        text: Input text to embed.

    Returns:
        1-D numpy array of shape (embedding_dim,), float32, L2-normalized.
    """
    if not _model_loaded or _model is None:
        raise ModelNotLoadedError("embedding")

    # Bound to model's effective context (256 tokens ~ 1500 chars) for high-speed inference
    truncated = text[:3000] if len(text) > 3000 else text
    embedding = _model.encode(truncated, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
    return embedding.astype(np.float32)


def get_embeddings_batch(texts: list[str]) -> np.ndarray:
    """
    Generate L2-normalized embeddings for a batch of texts.

    Returns:
        2-D numpy array of shape (n, embedding_dim), float32.
    """
    if not _model_loaded or _model is None:
        raise ModelNotLoadedError("embedding")

    bounded_texts = [t[:3000] for t in texts]
    embeddings = _model.encode(
        bounded_texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=32,
    )
    return embeddings.astype(np.float32)
