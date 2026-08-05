"""
FAISS search service: loads index + metadata, performs similarity search.
"""

import logging
import pickle
import threading
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
import pandas as pd

from app.config import get_settings
from app.core.exceptions import IndexNotLoadedError
from app.models import PatentResult
from app.utils import find_matching_keywords, generate_snippet

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_index: Optional[faiss.IndexFlatIP] = None
_metadata: Optional[pd.DataFrame] = None
_index_loaded: bool = False


def load_index() -> None:
    """Load FAISS index and metadata pickle from disk. Called once at startup."""
    global _index, _metadata, _index_loaded
    settings = get_settings()

    with _lock:
        if _index_loaded:
            return

        index_path = settings.FAISS_INDEX_PATH
        metadata_path = settings.METADATA_PATH

        if not index_path.exists():
            logger.warning(
                "FAISS index not found at '%s'. Run 'python scripts/build_index.py' to create it.",
                index_path,
            )
            return

        if not metadata_path.exists():
            logger.warning("Metadata pickle not found at '%s'.", metadata_path)
            return

        try:
            logger.info("Loading FAISS index from %s …", index_path)
            _index = faiss.read_index(str(index_path))

            logger.info("Loading patent metadata from %s …", metadata_path)
            with open(metadata_path, "rb") as f:
                _metadata = pickle.load(f)

            _index_loaded = True
            logger.info(
                "FAISS index loaded: %d vectors, %d patents in metadata.",
                _index.ntotal,
                len(_metadata),
            )
        except Exception as exc:
            logger.error("Failed to load FAISS index: %s", exc)
            raise


def is_index_loaded() -> bool:
    return _index_loaded


def search(query_embedding: np.ndarray, top_k: int, query_text: str) -> list[PatentResult]:
    """
    Search the FAISS index for the most similar patents.

    Args:
        query_embedding: 1-D float32 normalized embedding vector.
        top_k: Number of results to return.
        query_text: Original query text used for keyword matching/snippets.

    Returns:
        List of PatentResult sorted by descending similarity score.
    """
    if not _index_loaded or _index is None or _metadata is None:
        raise IndexNotLoadedError()

    # FAISS expects 2-D input: (n_queries, dim)
    query_vec = query_embedding.reshape(1, -1).astype(np.float32)

    scores, indices = _index.search(query_vec, min(top_k, _index.ntotal))

    results: list[PatentResult] = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue  # FAISS returns -1 for padding when fewer results exist

        row = _metadata.iloc[idx]
        patent_text = f"{row.get('title', '')} {row.get('abstract', '')} {row.get('description', '')}"

        result = PatentResult(
            id=str(row.get("id", idx)),
            title=str(row.get("title", "Unknown")),
            abstract=str(row.get("abstract", "")),
            description=str(row.get("description", "")),
            assignee=str(row.get("assignee", "")),
            publication_date=str(row.get("publication_date", "")),
            country=str(row.get("country", "")),
            ipc_class=str(row.get("ipc_class", "")),
            similarity_score=float(max(0.0, min(1.0, score))),
            matching_keywords=find_matching_keywords(query_text, patent_text),
            snippet=generate_snippet(patent_text, query_text),
        )
        results.append(result)

    return results
