"""
Shared utility functions used across the application.
"""

import re
import unicodedata
from collections import Counter


def clean_text(text: str) -> str:
    """Normalize unicode, remove control characters, collapse whitespace."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_keywords(text: str, top_n: int = 10) -> list[str]:
    """
    Extract the most frequent meaningful words from text.
    Simple TF-based extraction without external NLP dependencies.
    """
    STOP_WORDS = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "shall", "can", "this", "that",
        "these", "those", "it", "its", "which", "who", "what", "when", "where",
        "how", "why", "all", "any", "both", "each", "few", "more", "most",
        "other", "some", "such", "no", "not", "only", "same", "so", "than",
        "too", "very", "just", "also", "as", "if", "then", "there", "their",
        "they", "we", "our", "us", "you", "your", "he", "she", "him", "her",
        "his", "hers", "i", "me", "my", "mine",
    }
    words = re.findall(r"\b[a-z]{4,}\b", text.lower())
    filtered = [w for w in words if w not in STOP_WORDS]
    counter = Counter(filtered)
    return [word for word, _ in counter.most_common(top_n)]


def find_matching_keywords(query: str, patent_text: str, top_n: int = 8) -> list[str]:
    """Return query keywords that appear in the patent text."""
    query_keywords = set(extract_keywords(query, top_n=30))
    patent_lower = patent_text.lower()
    matches = [kw for kw in query_keywords if kw in patent_lower]
    return matches[:top_n]


def generate_snippet(text: str, query: str, max_chars: int = 300) -> str:
    """
    Find the most relevant portion of text relative to the query.
    Returns a snippet centered around the best matching sentence.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if not sentences:
        return text[:max_chars]

    query_words = set(re.findall(r"\b[a-z]{4,}\b", query.lower()))

    best_sentence = ""
    best_score = -1

    for sentence in sentences:
        sentence_words = set(re.findall(r"\b[a-z]{4,}\b", sentence.lower()))
        score = len(query_words & sentence_words)
        if score > best_score:
            best_score = score
            best_sentence = sentence

    if best_sentence:
        return best_sentence[:max_chars] + ("…" if len(best_sentence) > max_chars else "")
    return text[:max_chars] + ("…" if len(text) > max_chars else "")


def truncate_text(text: str, max_tokens: int = 1024) -> str:
    """
    Roughly truncate text to stay within a token budget.
    Uses word count as a proxy (1 word ≈ 1.3 tokens).
    """
    max_words = int(max_tokens / 1.3)
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "…"
