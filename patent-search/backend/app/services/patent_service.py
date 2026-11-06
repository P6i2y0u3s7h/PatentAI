"""
Patent service: metadata access, claim extraction, technical approach derivation,
and patent dataset lookup for comparison and novelty analysis.
"""

import logging
import pickle
import re
from typing import Any, Optional

import pandas as pd
from fastapi import HTTPException, status

from app.config import get_settings
from app.models import PatentResult
from app.services.search_service import _metadata, is_index_loaded, load_index
from app.utils import find_matching_keywords, generate_snippet

logger = logging.getLogger(__name__)


def _get_dataframe() -> pd.DataFrame:
    """Ensure metadata DataFrame is available, loading if necessary."""
    settings = get_settings()
    if not is_index_loaded() or _metadata is None:
        try:
            load_index()
        except Exception:
            pass

    from app.services.search_service import _metadata as active_meta
    if active_meta is not None and len(active_meta) > 0:
        return active_meta

    # Fallback to direct CSV read if FAISS metadata pickle not loaded
    if settings.PATENTS_CSV_PATH.exists():
        return pd.read_csv(settings.PATENTS_CSV_PATH)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Patent database metadata is currently unavailable.",
    )


def get_all_patents_list() -> list[dict[str, Any]]:
    """Return concise list of all available patents for selector dropdowns/modals."""
    df = _get_dataframe()
    results: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        results.append({
            "id": str(row.get("id", "")),
            "title": str(row.get("title", "")),
            "assignee": str(row.get("assignee", "")),
            "publication_date": str(row.get("publication_date", "")),
            "ipc_class": str(row.get("ipc_class", "")),
            "country": str(row.get("country", "")),
            "abstract_snippet": str(row.get("abstract", ""))[:180] + "...",
        })
    return results


def get_patent_by_id(patent_id: str) -> dict[str, Any]:
    """Retrieve full raw patent record by its patent ID (case-insensitive)."""
    df = _get_dataframe()
    clean_id = patent_id.strip().upper()
    matches = df[df["id"].astype(str).str.upper() == clean_id]
    if matches.empty:
        # Try matching title or prefix
        matches = df[df["title"].astype(str).str.contains(patent_id.strip(), case=False, regex=False)]

    if matches.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patent with ID or title '{patent_id}' was not found in the patent database.",
        )

    row = matches.iloc[0]
    return row.to_dict()


def to_patent_result(row_dict: dict[str, Any], similarity: float = 1.0) -> PatentResult:
    """Convert raw patent dictionary to PatentResult model."""
    patent_text = f"{row_dict.get('title', '')} {row_dict.get('abstract', '')} {row_dict.get('description', '')}"
    return PatentResult(
        id=str(row_dict.get("id", "")),
        title=str(row_dict.get("title", "Unknown")),
        abstract=str(row_dict.get("abstract", "")),
        description=str(row_dict.get("description", "")),
        assignee=str(row_dict.get("assignee", "")),
        publication_date=str(row_dict.get("publication_date", "")),
        country=str(row_dict.get("country", "")),
        ipc_class=str(row_dict.get("ipc_class", "")),
        similarity_score=float(max(0.0, min(1.0, similarity))),
        matching_keywords=find_matching_keywords(str(row_dict.get("title", "")), patent_text),
        snippet=generate_snippet(patent_text, str(row_dict.get("title", ""))),
    )


def extract_patent_claims(patent: dict[str, Any]) -> str:
    """
    Extract or generate formal structured patent claims based on the actual patent text.
    Uses authentic technical terminology from title, abstract, and description.
    """
    title = patent.get("title", "Invention")
    desc = patent.get("description", "")
    abstract = patent.get("abstract", "")

    # Extract technical phrases from sentences in the description
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", desc) if len(s.strip()) > 20]

    claim1_preamble = f"1. (Independent Claim) An apparatus and method for {title.lower()}, comprising:"
    elements = []

    if len(sentences) >= 1:
        elements.append(f"a processing subsystem configured to {sentences[0].rstrip('.').lower()}")
    else:
        elements.append(f"a subsystem configured to implement {abstract[:100].lower()}")

    if len(sentences) >= 2:
        elements.append(f"a controller operating to execute {sentences[1].rstrip('.').lower()}")
    if len(sentences) >= 3:
        elements.append(f"an architecture interface that {sentences[2].rstrip('.').lower()}")

    claims = [claim1_preamble]
    for el in elements:
        claims.append(f"   • {el}; and")
    if elements:
        claims[-1] = claims[-1][:-5] + "."  # replace '; and' with '.'

    if len(sentences) >= 4:
        claims.append(
            f"2. (Dependent Claim) The system of claim 1, further wherein {sentences[3].rstrip('.').lower()}."
        )
    if len(sentences) >= 5:
        claims.append(
            f"3. (Dependent Claim) The system of claim 1, wherein {sentences[4].rstrip('.').lower()}."
        )

    return "\n".join(claims)


def extract_technical_approach(patent: dict[str, Any]) -> str:
    """Derive the technical approach, architecture, and mechanism from description."""
    desc = patent.get("description", "")
    if not desc:
        return patent.get("abstract", "Technical details disclosed in specification.")

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", desc) if len(s.strip()) > 15]
    if len(sentences) <= 3:
        return desc

    # Pick the most architectural sentences
    arch_sentences = [
        s for s in sentences
        if any(term in s.lower() for term in ["comprise", "architecture", "model", "system", "circuit", "network", "module", "implement", "process", "algorithm", "using", "layer"])
    ]
    if arch_sentences:
        return " ".join(arch_sentences[:4])
    return " ".join(sentences[:3])


def extract_technical_features(text: str) -> list[str]:
    """
    Extract discrete technical features, components, and parameters from patent text.
    Returns cleaned list of distinct feature bullet points.
    """
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 25]
    features: list[str] = []

    for s in sentences:
        # Look for clauses that describe functional components or novel parameters
        cleaned_s = s.rstrip(".")
        if len(cleaned_s) > 180:
            cleaned_s = cleaned_s[:180] + "…"
        if any(w in cleaned_s.lower() for w in ["system", "layer", "network", "module", "algorithm", "frequency", "accelerator", "sensor", "model", "transformer", "circuit", "achieve", "protocol", "quantum", "memory", "unit", "interface"]):
            if cleaned_s not in features:
                features.append(cleaned_s)

    if not features and sentences:
        features = [sentences[0][:150]]

    return features[:6]

