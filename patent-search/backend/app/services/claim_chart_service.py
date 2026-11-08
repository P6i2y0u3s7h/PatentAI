"""
AI Claim Chart Generator Service.
Decomposes patent claims into discrete structural/functional limitations,
searches comparison prior-art or technical disclosures for verbatim/equivalent evidence,
classifies match statuses, and compiles institutional-grade claim charts.
"""

import json
import logging
import re
import time
import uuid
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.models import (
    ClaimChartResponse,
    ClaimElementComparison,
)
from app.services import embedding_service, patent_service
from app.services.document_service import decompose_claim_elements, parse_claims
from app.services.llm_service import call_groq_api, call_xai_grok_api

logger = logging.getLogger(__name__)


async def generate_claim_chart(
    doc_a_text: str,
    doc_b_text: str,
    doc_a_name: str = "Patent Claims (Doc A)",
    doc_b_name: str = "Comparison Document (Doc B)",
    title: str = "Patent Claim Chart Analysis",
    user_id: str = "anonymous",
) -> ClaimChartResponse:
    """
    Generate an AI Claim Chart comparing Document A's claims against Document B's technical evidence.
    """
    start_time = time.time()
    chart_id = f"chart_{uuid.uuid4().hex[:12]}"

    # Step 1: Extract and parse claims from Document A
    parsed_claims = parse_claims(doc_a_text)
    if not parsed_claims:
        # If no explicit claim format detected, break raw text into numbered limitation clauses
        clauses = [p.strip() for p in doc_a_text.splitlines() if len(p.strip()) > 15]
        if not clauses:
            clauses = [doc_a_text.strip()]
        parsed_claims = [{
            "number": 1,
            "claim_label": "Claim 1",
            "text": doc_a_text[:600],
            "is_dependent": False,
            "parent_claim": None,
            "elements": [{"id": f"1.{i+1}", "is_preamble": i == 0, "text": c} for i, c in enumerate(clauses[:6])],
        }]

    # Step 2: Segment Document B into evidentiary paragraphs / passages
    doc_b_passages = segment_evidence_passages(doc_b_text)

    # Step 3: Map each claim element against Document B evidence
    all_elements_comparison: List[ClaimElementComparison] = []

    # Flatten elements
    flat_elements: List[Tuple[str, str, str, bool, Optional[str]]] = []
    for c in parsed_claims:
        c_label = c["claim_label"]
        parent = c.get("parent_claim")
        for el in c["elements"]:
            flat_elements.append((c_label, el["id"], el["text"], el.get("is_preamble", False), parent))

    # Cap at 15 elements to guarantee responsive generation
    eval_elements = flat_elements[:15]

    for c_label, el_id, el_text, is_preamble, parent_claim in eval_elements:
        evidence_text, evidence_src, match_status, explanation = match_element_against_evidence(
            el_text, is_preamble, doc_b_passages, doc_b_name
        )

        all_elements_comparison.append(ClaimElementComparison(
            claim_number=c_label,
            element_id=el_id,
            element_text=el_text,
            is_preamble=is_preamble,
            parent_claim=parent_claim,
            evidence_text=evidence_text,
            evidence_source=evidence_src,
            match_status=match_status,
            explanation=explanation,
        ))

    # Optional Step 4: Run Groq LLM refinement for deep legal analysis if available
    llm_refined = await run_llm_claim_chart_refinement(
        all_elements_comparison[:8], doc_b_text[:3500], doc_a_name, doc_b_name
    )
    if llm_refined:
        # Merge LLM refinements
        ref_map = {r.element_id: r for r in llm_refined}
        for i, item in enumerate(all_elements_comparison):
            if item.element_id in ref_map:
                all_elements_comparison[i] = ref_map[item.element_id]

    # Step 5: Compute Metrics & Risk Level
    matches_count = sum(1 for e in all_elements_comparison if e.match_status == "Match")
    partial_count = sum(1 for e in all_elements_comparison if e.match_status == "Partial Match")
    not_found_count = sum(1 for e in all_elements_comparison if e.match_status == "Not Found")
    review_count = sum(1 for e in all_elements_comparison if e.match_status == "Requires Manual Review")
    total_elements = len(all_elements_comparison)

    coverage_score = round(((matches_count * 1.0 + partial_count * 0.5) / max(1, total_elements)) * 100, 1)

    if coverage_score >= 70:
        risk_level = "High Claim Overlap — Potential Anticipation / Infringement Risk"
    elif coverage_score >= 40:
        risk_level = "Moderate Claim Overlap — Obviousness / Doctrine of Equivalents Concern"
    else:
        risk_level = "Low Overlap — Significant Claim Whitespace Identified"

    summary_analysis = (
        f"Claim chart evaluation for '{title}' compared {total_elements} individual technical claim limitations "
        f"from '{doc_a_name}' against disclosures in '{doc_b_name}'. "
        f"Results indicate {matches_count} direct matches, {partial_count} partial matches, {not_found_count} unmapped elements, "
        f"and {review_count} elements requiring manual legal review, resulting in an aggregate claim evidence score of {coverage_score}%."
    )

    recommendations = [
        f"Focus claim differentiation on the {not_found_count} limitations where no supporting evidence was found in {doc_b_name}.",
        "For partially matched elements, introduce narrower functional parameters to overcome prior-art rejection under 35 U.S.C. 103.",
        "Review dependent claim additions to ensure secondary novel fallback positions are documented in the specification.",
        "Verify prosecution history estoppel and canonical claim interpretation standards (Phillips standard) for ambiguous terms.",
    ]

    disclaimer = (
        "IMPORTANT LEGAL NOTICE: This AI-generated claim chart is an automated preliminary technical comparison. "
        "A finding of 'Not Found' in this comparison document does NOT establish that a feature is novel, non-obvious, "
        "or absent from the global prior-art record. Conversely, a 'Match' does not constitute an official legal determination "
        "of patent anticipation or patent infringement. Formal legal opinions require licensed patent counsel."
    )

    processing_time = round((time.time() - start_time) * 1000, 2)

    return ClaimChartResponse(
        id=chart_id,
        user_id=user_id,
        title=title,
        doc_a_name=doc_a_name,
        doc_b_name=doc_b_name,
        doc_a_type="Patent Claims",
        doc_b_type="Comparison Disclosure",
        elements=all_elements_comparison,
        total_elements=total_elements,
        matches_count=matches_count,
        partial_matches_count=partial_count,
        not_found_count=not_found_count,
        requires_review_count=review_count,
        coverage_score=coverage_score,
        summary_analysis=summary_analysis,
        risk_level=risk_level,
        recommendations=recommendations,
        disclaimer=disclaimer,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        processing_time_ms=processing_time,
    )


def segment_evidence_passages(doc_text: str) -> List[Dict[str, any]]:
    """Segment Document B into numbered technical paragraphs for evidentiary citations."""
    paragraphs = [p.strip() for p in doc_text.split("\n\n") if len(p.strip()) > 30]
    if not paragraphs:
        paragraphs = [p.strip() for p in doc_text.splitlines() if len(p.strip()) > 30]

    passages: List[Dict[str, any]] = []
    for idx, p in enumerate(paragraphs):
        # Check if text has existing paragraph identifier e.g. [0032] or Paragraph 14
        para_label = f"Paragraph [{idx+1:04d}]"
        m = re.match(r"^(\[\d{4}\]|\bpara(?:graph)?\s*\d+\b)", p, re.IGNORECASE)
        if m:
            para_label = m.group(1)

        passages.append({
            "index": idx + 1,
            "label": para_label,
            "text": p,
        })
    return passages


def match_element_against_evidence(
    element_text: str,
    is_preamble: bool,
    doc_b_passages: List[Dict[str, any]],
    doc_b_name: str,
) -> Tuple[str, str, str, str]:
    """
    Find best matching passage in Document B for a given claim limitation.
    Returns: (evidence_text, evidence_source, match_status, explanation)
    """
    if is_preamble:
        # Preamble usually names general apparatus or method
        for p in doc_b_passages[:5]:
            kw_match = len(set(re.findall(r"\w{4,}", element_text.lower())) & set(re.findall(r"\w{4,}", p["text"].lower())))
            if kw_match >= 2:
                return (
                    p["text"][:280] + ("..." if len(p["text"]) > 280 else ""),
                    f"{doc_b_name}, {p['label']}",
                    "Match",
                    "Preamble apparatus field is directly disclosed in the introduction/background of the comparison document.",
                )
        return (
            "Field generally recognized in technological domain.",
            f"{doc_b_name}, General Context",
            "Match",
            "Preamble terminology corresponds to general technological framework.",
        )

    # Clean element text keywords
    elem_words = set(re.findall(r"\b[a-z]{4,20}\b", element_text.lower()))
    stop_words = {"wherein", "comprising", "configured", "plurality", "further", "first", "second", "least", "said"}
    significant_words = elem_words - stop_words

    best_passage = None
    best_overlap = 0

    for p in doc_b_passages:
        p_words = set(re.findall(r"\b[a-z]{4,20}\b", p["text"].lower()))
        overlap = len(significant_words & p_words)
        if overlap > best_overlap:
            best_overlap = overlap
            best_passage = p

    if not significant_words or not best_passage:
        return (
            "No evidence found in comparison document.",
            f"{doc_b_name}, Complete Specification",
            "Not Found",
            "No corresponding technical limitation or analogous teaching was identified in Document B.",
        )

    overlap_ratio = best_overlap / max(1, len(significant_words))

    if overlap_ratio >= 0.65 or best_overlap >= 4:
        return (
            best_passage["text"][:350] + ("..." if len(best_passage["text"]) > 350 else ""),
            f"{doc_b_name}, {best_passage['label']}",
            "Match",
            f"Explicit disclosure of core features. Shared limitations include: {', '.join(list(significant_words & set(re.findall(r'[a-z]{4,}', best_passage['text'].lower())))[:4])}.",
        )
    elif overlap_ratio >= 0.35 or best_overlap >= 2:
        return (
            best_passage["text"][:300] + ("..." if len(best_passage["text"]) > 300 else ""),
            f"{doc_b_name}, {best_passage['label']}",
            "Partial Match",
            "Discloses an analogous or related mechanism, but lacks exact recitation of all specified limitation parameters.",
        )
    else:
        return (
            "No direct or equivalent teaching disclosed.",
            f"{doc_b_name}, Specification",
            "Not Found",
            f"The specific combination of technical limitations ({element_text[:80]}...) appears absent from Document B.",
        )


async def run_llm_claim_chart_refinement(
    elements: List[ClaimElementComparison],
    doc_b_context: str,
    doc_a_name: str,
    doc_b_name: str,
) -> Optional[List[ClaimElementComparison]]:
    """Use Groq LLM to refine evidence citations and legal explanations."""
    elements_json = [
        {"element_id": e.element_id, "claim_number": e.claim_number, "text": e.element_text}
        for e in elements
    ]

    prompt = f"""You are a specialized patent litigation partner preparing a formal USPTO/court Claim Chart.
Compare the following Claim Elements from '{doc_a_name}' against the evidentiary disclosure in '{doc_b_name}'.

DOCUMENT B DISCLOSURE:
{doc_b_context}

CLAIM ELEMENTS TO MAP:
{json.dumps(elements_json, indent=2)}

For each claim element, find the exact quoting passage or note absence, classify match status, and provide technical explanation.
Allowed Match Status values strictly: "Match", "Partial Match", "Not Found", or "Requires Manual Review".

Respond ONLY with a valid JSON array of objects formatted as:
[
  {{
    "element_id": "1.1",
    "claim_number": "Claim 1",
    "element_text": "text of element",
    "is_preamble": false,
    "parent_claim": null,
    "evidence_text": "Verbatim quote from Document B or 'No evidence found'",
    "evidence_source": "{doc_b_name}, Paragraph [XXXX]",
    "match_status": "Match" | "Partial Match" | "Not Found" | "Requires Manual Review",
    "explanation": "Precise legal and technical mapping explanation"
  }}
]"""

    system_inst = "You are a patent claim chart expert. Return valid JSON only without formatting commentary."

    resp = await call_groq_api(prompt, system_inst)
    if not resp:
        resp = await call_xai_grok_api(prompt, system_inst)

    if not resp:
        return None

    try:
        cleaned = re.sub(r"^```json\s*", "", resp.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned)
        if isinstance(data, list):
            res = []
            for item in data:
                if isinstance(item, dict) and "element_id" in item:
                    res.append(ClaimElementComparison(
                        claim_number=item.get("claim_number", "Claim 1"),
                        element_id=item.get("element_id", "1.1"),
                        element_text=item.get("element_text", ""),
                        is_preamble=item.get("is_preamble", False),
                        parent_claim=item.get("parent_claim"),
                        evidence_text=item.get("evidence_text", "No evidence found"),
                        evidence_source=item.get("evidence_source", f"{doc_b_name}, Specification"),
                        match_status=item.get("match_status", "Partial Match"),
                        explanation=item.get("explanation", ""),
                    ))
            return res
    except Exception as exc:
        logger.warning("[CLAIM_CHART] LLM refinement parse warning: %s", exc)

    return None
