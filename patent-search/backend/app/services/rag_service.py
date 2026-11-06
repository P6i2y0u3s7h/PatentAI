"""
Retrieval-Augmented Generation (RAG) service.
Chunks patent documents, embeds sections, and retrieves relevant context
for answering questions and grounding analysis in actual patent content.
"""

import logging
import re
from typing import Any

import numpy as np

from app.services import embedding_service
from app.utils import clean_text, extract_keywords

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size_words: int = 220, overlap_words: int = 40) -> list[dict[str, Any]]:
    """
    Split text into overlapping semantic passages.
    Preserves paragraph and sentence boundaries wherever feasible.
    """
    cleaned = clean_text(text)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]

    # If document has few paragraphs, split by sentences
    units: list[str] = []
    if len(paragraphs) < 3:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
        units = sentences
    else:
        units = paragraphs

    chunks: list[dict[str, Any]] = []
    current_words: list[str] = []
    current_idx = 1

    for unit in units:
        unit_words = unit.split()
        if not unit_words:
            continue

        if len(current_words) + len(unit_words) > chunk_size_words and current_words:
            chunk_content = " ".join(current_words)
            chunks.append({
                "chunk_id": current_idx,
                "text": chunk_content,
                "word_count": len(current_words),
            })
            current_idx += 1
            # retain overlap
            current_words = current_words[-overlap_words:] if len(current_words) > overlap_words else []

        current_words.extend(unit_words)

    if current_words:
        chunks.append({
            "chunk_id": current_idx,
            "text": " ".join(current_words),
            "word_count": len(current_words),
        })

    logger.info("[RAG] Document chunked into %d passages (chunk_size=%d).", len(chunks), chunk_size_words)
    return chunks


def score_chunk_lexical(query: str, chunk_text: str) -> float:
    """Lightweight TF-IDF / keyword similarity score for lexical grounding."""
    q_words = set(extract_keywords(query, top_n=20))
    if not q_words:
        q_words = set(re.findall(r"\b[a-z]{3,}\b", query.lower()))
    if not q_words:
        return 0.0

    chunk_lower = chunk_text.lower()
    matches = sum(1 for w in q_words if w in chunk_lower)
    return float(matches / max(len(q_words), 1))


def retrieve_relevant_chunks(
    query: str,
    doc_text: str,
    top_k: int = 4,
) -> list[dict[str, Any]]:
    """
    Retrieve the top-K most relevant chunks from a document using semantic + lexical ranking.
    """
    if not doc_text or not doc_text.strip():
        return []

    chunks = chunk_text(doc_text)
    if not chunks:
        return []

    if len(chunks) <= top_k:
        # Document is short enough that all chunks are relevant
        for c in chunks:
            c["score"] = 1.0
        return chunks

    # Attempt semantic scoring via embedding model
    try:
        if embedding_service.is_embedding_model_loaded():
            q_emb = embedding_service.get_embedding(query)
            chunk_texts = [c["text"] for c in chunks]
            c_embs = embedding_service.get_embeddings_batch(chunk_texts)

            # Cosine similarity (dot product of L2-normalized vectors)
            similarities = np.dot(c_embs, q_emb)

            for i, c in enumerate(chunks):
                lexical = score_chunk_lexical(query, c["text"])
                # Hybrid score: 70% dense semantic, 30% lexical keyword overlap
                c["score"] = float(0.7 * similarities[i] + 0.3 * lexical)
        else:
            for c in chunks:
                c["score"] = score_chunk_lexical(query, c["text"])
    except Exception as exc:
        logger.warning("[RAG] Semantic chunk scoring fallback to lexical: %s", exc)
        for c in chunks:
            c["score"] = score_chunk_lexical(query, c["text"])

    ranked = sorted(chunks, key=lambda x: x.get("score", 0.0), reverse=True)
    return ranked[:top_k]


def build_grounded_context(retrieved_chunks: list[dict[str, Any]]) -> tuple[str, list[str]]:
    """
    Format retrieved chunks into a clear context prompt for the LLM.
    Returns (context_text, list_of_source_labels).
    """
    if not retrieved_chunks:
        return "", []

    context_parts: list[str] = []
    sources: list[str] = []

    for i, c in enumerate(retrieved_chunks, 1):
        label = f"Section {c.get('chunk_id', i)}"
        sources.append(label)
        context_parts.append(f"[{label}]\n{c['text']}")

    return "\n\n".join(context_parts), sources

