"""
AI Patent Draft Reviewer Service.
Performs comprehensive multi-dimensional patent draft analysis:
1. Technical Clarity & Consistency Review
2. Patent Structure & Section Completeness Review
3. Patent Claims Defect & Dependency Review
4. Missing Information & Best-Practice Diagnostics
5. Actionable AI Recommendations with Verbatim Before/After Fixes
"""

import json
import logging
import re
import time
import uuid
from typing import Dict, List, Optional, Tuple

from app.models import (
    DraftIssue,
    DraftReviewResponse,
    DraftSectionStatus,
)
from app.services.document_service import (
    STANDARD_SECTIONS,
    decompose_claim_elements,
    parse_claims,
    segment_patent_draft,
)
from app.services.llm_service import call_groq_api, call_xai_grok_api

logger = logging.getLogger(__name__)

AMBIGUOUS_PATTERNS = [
    (r"\b(about|around|approximately)\s+\d+", "Indefinite Numerical Range", "Use of approximate modifiers ('about', 'around') can create indefiniteness rejections under 35 U.S.C. 112(b) unless the tolerance range or specification explicitly clarifies the permissible variance.", "Medium"),
    (r"\b(substantially|substantially similar|substantially equal)\b", "Relative Term of Degree", "The term 'substantially' is a relative term that examiners frequently reject unless the specification defines a measurable standard or functional benchmark.", "Medium"),
    (r"\b(effective amount|suitable amount|optimal amount)\b", "Subjective Quality Metric", "Terms like 'effective amount' or 'optimal' lack objective criteria unless accompanied by an explicit test procedure or quantifiable range.", "High"),
    (r"\b(etc\.|and so forth|and the like)\b", "Open-Ended Vagueness in Claims/Specs", "'etc.' and 'and the like' introduce ambiguity regarding the boundaries of the disclosure. Replace with an explicit non-limiting exemplary phrase such as 'for example, including [X] and [Y]'.", "Medium"),
    (r"\b(user-friendly|cost-effective|cheap|superior|best)\b", "Commercial / Laudatory Puffery", "Commercial buzzwords provide no patentable technical weight and can be misconstrued during claim interpretation or examination as non-technical limitations.", "Low"),
    (r"\b(customary|known in the art|conventional)\b", "Premature Admission of Prior Art", "Characterizing features as 'conventional' or 'known in the art' may be treated by patent offices as an applicant admission of prior art against the invention.", "High"),
]


async def review_patent_draft(
    raw_text: str,
    title: str = "",
    technical_field: str = "",
    review_type: str = "Comprehensive Review",
    user_id: str = "anonymous",
) -> DraftReviewResponse:
    """
    Execute AI Patent Draft Review workflow.
    """
    start_time = time.time()
    review_id = f"rev_{uuid.uuid4().hex[:12]}"

    # Step 1: Segment into patent application sections
    sections = segment_patent_draft(raw_text)
    if title and not sections.get("Title of Invention"):
        sections["Title of Invention"] = title

    # Step 2: Evaluate Structure & Completeness
    section_statuses, structure_issues = evaluate_structure(sections)

    # Step 3: Technical & Consistency Review
    technical_issues, missing_info_issues = evaluate_technical_clarity(sections, technical_field)

    # Step 4: Claims Review
    claims_issues = evaluate_claims(sections.get("Claims", ""))

    # Step 5: Advanced LLM Deep-Audit (Groq/Gemini with NLP fallback)
    llm_issues = await run_llm_draft_audit(raw_text, title, technical_field, review_type)

    # Combine and de-duplicate issues
    all_issues = structure_issues + technical_issues + missing_info_issues + claims_issues
    if llm_issues:
        existing_titles = {i.title.lower() for i in all_issues}
        for li in llm_issues:
            if li.title.lower() not in existing_titles:
                all_issues.append(li)

    # Calculate Quality Score & Counts
    tech_count = sum(1 for i in all_issues if i.category == "technical")
    struct_count = sum(1 for i in all_issues if i.category == "structure")
    claims_count = sum(1 for i in all_issues if i.category == "claims")
    missing_count = sum(1 for i in all_issues if i.category == "missing_info")

    quality_score, score_verdict = compute_quality_score(section_statuses, all_issues)
    recommendations = generate_overall_recommendations(section_statuses, all_issues, technical_field)
    overall_summary = generate_executive_summary(title or sections.get("Title of Invention", "Patent Draft"), quality_score, score_verdict, all_issues)

    processing_time = round((time.time() - start_time) * 1000, 2)

    return DraftReviewResponse(
        id=review_id,
        user_id=user_id,
        title=title or sections.get("Title of Invention", "Untitled Patent Draft"),
        technical_field=technical_field or "General Technology",
        review_type=review_type,
        quality_score=quality_score,
        score_verdict=score_verdict,
        sections=section_statuses,
        issues=all_issues,
        technical_issues_count=tech_count,
        structure_issues_count=struct_count,
        claims_issues_count=claims_count,
        missing_info_count=missing_count,
        overall_summary=overall_summary,
        recommendations=recommendations,
        disclaimer=(
            "DISCLAIMER: This review is an automated AI-generated diagnostic quality assessment "
            "designed to assist inventors and patent professionals in identifying potential clarity, "
            "structural, and claiming issues. It does not constitute formal legal counsel or a guarantee of patentability."
        ),
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        processing_time_ms=processing_time,
    )


def evaluate_structure(sections: Dict[str, str]) -> Tuple[List[DraftSectionStatus], List[DraftIssue]]:
    """Verify presence and minimum substantive depth of the 7 standard patent sections."""
    statuses: List[DraftSectionStatus] = []
    issues: List[DraftIssue] = []

    for sec in STANDARD_SECTIONS:
        content = sections.get(sec, "").strip()
        length = len(content)

        if not content:
            statuses.append(DraftSectionStatus(
                section_name=sec,
                present=False,
                status="Missing",
                details=f"The '{sec}' section was not detected in this draft.",
            ))
            issues.append(DraftIssue(
                id=f"struct_miss_{sec.lower().replace(' ', '_')}",
                title=f"Missing Section: {sec}",
                original_text="",
                explanation=f"A compliant patent application under USPTO/EPO standards requires a dedicated '{sec}' section.",
                severity="High" if sec in ["Claims", "Abstract", "Detailed Description"] else "Medium",
                category="structure",
                suggested_improvement=f"Add a distinct header titled '{sec}' and draft the corresponding technical specification.",
                reason="Absence of required specification sections may lead to a Formalities Notice to File Missing Parts or specification rejection.",
            ))
        elif sec == "Abstract" and length > 1500:
            statuses.append(DraftSectionStatus(
                section_name=sec,
                present=True,
                status="Needs Improvement",
                details=f"Abstract contains {len(content.split())} words (standard recommendation is under 150 words).",
            ))
            issues.append(DraftIssue(
                id="struct_abs_len",
                title="Abstract Exceeds Recommended Length",
                original_text=content[:200] + "...",
                explanation="Patent office rules (e.g. 37 CFR 1.72(b)) specify an abstract should generally not exceed 150 words (typically one paragraph).",
                severity="Low",
                category="structure",
                suggested_improvement="Condense the abstract to a single concise paragraph (50–150 words) focusing strictly on the technical problem and core novel solution.",
                reason="Examiners and automated classification algorithms require concise abstracts for database indexing.",
            ))
        elif sec == "Claims" and length < 60:
            statuses.append(DraftSectionStatus(
                section_name=sec,
                present=True,
                status="Needs Improvement",
                details="Claims section is present but appears sparse or incomplete.",
            ))
            issues.append(DraftIssue(
                id="struct_claims_sparse",
                title="Incomplete or Truncated Claims Section",
                original_text=content,
                explanation="The claims section contains very little technical recitation. A patent's legal protection is defined entirely by its claims.",
                severity="High",
                category="claims",
                suggested_improvement="Draft at least one complete independent claim reciting all essential structural/functional limitations, followed by dependent claims.",
                reason="Without adequately articulated claims, a patent application cannot establish legally enforceable exclusionary boundaries.",
            ))
        else:
            statuses.append(DraftSectionStatus(
                section_name=sec,
                present=True,
                status="Complete",
                details=f"Section present ({len(content.split())} words).",
            ))

    return statuses, issues


def evaluate_technical_clarity(sections: Dict[str, str], technical_field: str) -> Tuple[List[DraftIssue], List[DraftIssue]]:
    """Scan detailed description and background for ambiguous terminology, missing metrics, and vague phrases."""
    tech_issues: List[DraftIssue] = []
    missing_issues: List[DraftIssue] = []

    desc = sections.get("Detailed Description", "") + " " + sections.get("Summary of Invention", "")
    if not desc.strip():
        return tech_issues, missing_issues

    # 1. Regex Ambiguity & Indefiniteness Scans
    for pattern, title, explanation, severity in AMBIGUOUS_PATTERNS:
        matches = list(re.finditer(pattern, desc, re.IGNORECASE))
        for m in matches[:2]:  # Limit to 2 occurrences per pattern to avoid clutter
            snippet = desc[max(0, m.start() - 40):min(len(desc), m.end() + 40)].strip()
            tech_issues.append(DraftIssue(
                id=f"tech_ambig_{m.start()}",
                title=title,
                original_text=f"...{snippet}...",
                explanation=explanation,
                severity=severity,
                category="technical",
                suggested_improvement=re.sub(pattern, "[EXPLICIT NUMERICAL RANGE OR OPERATIONAL THRESHOLD]", snippet, flags=re.IGNORECASE),
                reason="Indefinite or relative qualifiers compromise the clarity requirement of patent drafting.",
            ))

    # 2. Check for Reference Numerals in Detailed Description
    ref_nums = re.findall(r"\b\d{3,4}\b", desc)
    has_drawings = bool(sections.get("Drawings and References", "").strip())
    if has_drawings and len(ref_nums) < 5:
        missing_issues.append(DraftIssue(
            id="miss_ref_numerals",
            title="Sparse Reference Numerals in Detailed Description",
            original_text="Detailed description references few or no numerical component identifiers.",
            explanation="When patent drawings are provided, best practice requires consistent reference numerals (e.g. 'sensor (102)', 'processor (104)') throughout the detailed description.",
            severity="Medium",
            category="missing_info",
            suggested_improvement="Annotate all components and structural sub-assemblies with consistent reference numerals corresponding directly to figures.",
            reason="Correlating drawings with text via reference numerals satisfies the enablement and best mode standards under patent guidelines.",
        ))

    # 3. Check for enablement: Missing technical parameters or operating conditions
    has_metrics = bool(re.search(r"\b(\d+\s*(?:MHz|GHz|ms|seconds|volts|watts|kb|mb|gb|nm|mm|cm|kg|degrees))\b", desc, re.IGNORECASE))
    if len(desc) > 500 and not has_metrics:
        missing_issues.append(DraftIssue(
            id="miss_op_metrics",
            title="Missing Concrete Operating Parameters & Ranges",
            original_text="Specification provides functional descriptions but omits concrete operating ranges or performance specifications.",
            explanation="The draft does not specify numerical operating thresholds, frequency ranges, data throughputs, or dimensional bounds.",
            severity="Medium",
            category="missing_info",
            suggested_improvement="Incorporate representative embodiments with specific operating parameters (e.g. clock speeds, latency tolerances, temperature limits).",
            reason="Providing concrete ranges prevents rejections for lack of written description or failure to teach how to make and use the invention.",
        ))

    return tech_issues, missing_issues


def evaluate_claims(claims_text: str) -> List[DraftIssue]:
    """Inspect claims for antecedent basis violations, dependency errors, and drafting defects."""
    issues: List[DraftIssue] = []
    if not claims_text.strip():
        return issues

    parsed = parse_claims(claims_text)
    if not parsed:
        issues.append(DraftIssue(
            id="claims_no_num",
            title="Non-Standard Claim Numbering",
            original_text=claims_text[:150],
            explanation="Claims do not follow standard consecutive numbering (e.g. '1. A system...', '2. The system of claim 1...').",
            severity="High",
            category="claims",
            suggested_improvement="Format claims consecutively starting with Claim 1, using single-sentence structure ending with a period.",
            reason="Patent rules require each claim to be a single sentence preceded by its claim number.",
        ))
        return issues

    known_claim_numbers = {c["number"] for c in parsed}

    for c in parsed:
        c_num = c["number"]
        c_body = c["text"]

        # 1. Preamble & Transitional Phrase
        if not re.search(r"(?i)\b(comprising|consisting of|consisting essentially of)\b", c_body):
            issues.append(DraftIssue(
                id=f"claim_{c_num}_trans",
                title=f"Claim {c_num}: Missing Standard Transitional Phrase",
                original_text=c_body[:120] + "...",
                explanation=f"Claim {c_num} lacks a recognized open ('comprising') or closed ('consisting of') transition phrase.",
                severity="Medium",
                category="claims",
                suggested_improvement=f"Restructure Claim {c_num} to use the canonical open-ended format: 'A [device/method] for [purpose], comprising: [element 1]; and [element 2].'",
                reason="'Comprising' ensures open-ended scope, protecting the claim against infringement avoidance by adding extra unrecited features.",
            ))

        # 2. Dependent Claim Dependency Existence
        if c["is_dependent"]:
            dep_target_match = re.search(r"(?i)(?:of|according to|in)\s+claim\s+(\d+)", c_body)
            if dep_target_match:
                parent_num = int(dep_target_match.group(1))
                if parent_num >= c_num:
                    issues.append(DraftIssue(
                        id=f"claim_{c_num}_dep_forward",
                        title=f"Claim {c_num}: Invalid Forward Dependency",
                        original_text=f"References claim {parent_num} from claim {c_num}",
                        explanation=f"Dependent Claim {c_num} refers to Claim {parent_num}. Dependent claims must only refer back to preceding claims.",
                        severity="High",
                        category="claims",
                        suggested_improvement=f"Update Claim {c_num} to depend only on an earlier numbered claim (e.g. Claim {c_num - 1} or Claim 1).",
                        reason="Forward references violate 37 CFR 1.75(c) and are automatically objected to by patent examiners.",
                    ))
                elif parent_num not in known_claim_numbers:
                    issues.append(DraftIssue(
                        id=f"claim_{c_num}_dep_missing",
                        title=f"Claim {c_num}: References Non-Existent Claim {parent_num}",
                        original_text=f"...of claim {parent_num}...",
                        explanation=f"Claim {c_num} purports to depend from Claim {parent_num}, which is not present in the draft.",
                        severity="High",
                        category="claims",
                        suggested_improvement=f"Adjust dependency of Claim {c_num} to match an existing independent or dependent claim.",
                        reason="Dangling dependency prevents determining the scope of the claim.",
                    ))

        # 3. Antecedent Basis Checks (e.g. 'said widget' or 'the widget' without prior 'a widget')
        the_mentions = re.findall(r"\b(?:said|the)\s+([a-z]{3,20}(?:\s+[a-z]{3,20})?)\b", c_body, re.IGNORECASE)
        for term in the_mentions:
            term_clean = term.strip().lower()
            if term_clean in ["system", "method", "invention", "device", "process", "following", "same", "art"]:
                continue
            # Look for introductory 'a [term]' or 'an [term]' before this occurrence
            intro_match = re.search(rf"\b(?:a|an|at least one)\s+{re.escape(term_clean)}\b", c_body, re.IGNORECASE)
            if not intro_match and not c["is_dependent"]:
                issues.append(DraftIssue(
                    id=f"claim_{c_num}_ant_{term_clean.replace(' ', '_')}",
                    title=f"Claim {c_num}: Potential Missing Antecedent Basis for '{term}'",
                    original_text=f"...the/said {term}...",
                    explanation=f"The limitation recites 'the {term}' or 'said {term}', but '{term}' does not appear to have been introduced earlier with 'a/an/at least one {term}'.",
                    severity="Medium",
                    category="claims",
                    suggested_improvement=f"Introduce the element earlier in Claim {c_num} as 'at least one {term}' before referring back to 'the {term}'.",
                    reason="Lack of antecedent basis is one of the most common 35 U.S.C. 112(b) indefiniteness rejections issued by patent examiners.",
                ))
                break  # Max 1 per claim

    return issues


async def run_llm_draft_audit(
    raw_text: str, title: str, technical_field: str, review_type: str
) -> List[DraftIssue]:
    """Execute Groq LLM deep-analysis for subtle patent drafting errors."""
    prompt = f"""You are a Master Patent Attorney and USPTO/EPO Patent Examination Quality Auditor.
Analyze the following patent draft and identify specific technical flaws, vague claim language, inconsistent terms, or missing disclosures.

Invention Title: {title or 'Unspecified'}
Technical Field: {technical_field or 'General Technology'}
Review Type: {review_type}

PATENT DRAFT EXCERPT (first 4,000 characters):
{raw_text[:4000]}

Perform a rigorous diagnostic audit across:
1. Technical Clarity & ambiguous statements
2. Claims structure & limitation precision
3. Missing technical parameters or implementation details

Respond ONLY with a valid JSON array of issues (maximum 4 high-value issues). Do not wrap in markdown or backticks if possible, or use standard ```json.
Format each item strictly as:
[
  {{
    "id": "llm_issue_1",
    "title": "Short title of issue",
    "original_text": "Verbatim quote or short excerpt from draft showing issue",
    "explanation": "Why this creates legal or technical issues during examination",
    "severity": "High" | "Medium" | "Low",
    "category": "technical" | "structure" | "claims" | "missing_info",
    "suggested_improvement": "Exact rewritten text or actionable revision",
    "reason": "Statutory basis or patent drafting best practice reason"
  }}
]"""

    system_inst = "You are a specialized patent quality auditor. Return valid JSON only without commentary."

    llm_output = await call_groq_api(prompt, system_inst)
    if not llm_output:
        llm_output = await call_xai_grok_api(prompt, system_inst)

    if not llm_output:
        return []

    try:
        cleaned = re.sub(r"^```json\s*", "", llm_output.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned)
        if isinstance(data, list):
            res = []
            for item in data:
                if isinstance(item, dict) and "title" in item and "explanation" in item:
                    res.append(DraftIssue(
                        id=item.get("id") or f"llm_{uuid.uuid4().hex[:6]}",
                        title=item.get("title", "Drafting Refinement"),
                        original_text=item.get("original_text", ""),
                        explanation=item.get("explanation", ""),
                        severity=item.get("severity", "Medium"),
                        category=item.get("category", "technical"),
                        suggested_improvement=item.get("suggested_improvement", ""),
                        reason=item.get("reason", "Patent examination clarity requirement"),
                    ))
            return res
    except Exception as exc:
        logger.warning("[DRAFT_REVIEW] LLM JSON parsing notice: %s", exc)

    return []


def compute_quality_score(sections: List[DraftSectionStatus], issues: List[DraftIssue]) -> Tuple[float, str]:
    """Compute 0-100 draft quality score based on section completeness and severity of issues."""
    score = 100.0

    # Section penalties
    for s in sections:
        if s.status == "Missing":
            score -= 10.0
        elif s.status == "Needs Improvement":
            score -= 4.0

    # Issue penalties
    for issue in issues:
        if issue.severity == "High":
            score -= 7.0
        elif issue.severity == "Medium":
            score -= 3.5
        elif issue.severity == "Low":
            score -= 1.5

    score = max(15.0, min(96.0, round(score, 1)))

    if score >= 85:
        verdict = "Strong Draft Quality — Minor Polish Recommended"
    elif score >= 70:
        verdict = "Acceptable Draft — Noticeable Claim & Clarity Revisions Needed"
    elif score >= 50:
        verdict = "Substantial Revisions Required — Significant Clarity & Structural Gaps"
    else:
        verdict = "Early Incomplete Draft — Extensive Restructuring Required"

    return score, verdict


def generate_overall_recommendations(
    sections: List[DraftSectionStatus], issues: List[DraftIssue], technical_field: str
) -> List[str]:
    """Generate concise strategic recommendations for improving the draft."""
    recs: List[str] = []

    missing_secs = [s.section_name for s in sections if s.status == "Missing"]
    if missing_secs:
        recs.append(f"Incorporate missing formal sections: {', '.join(missing_secs)} before filing to avoid office formalities actions.")

    high_issues = [i for i in issues if i.severity == "High"]
    if high_issues:
        recs.append(f"Address {len(high_issues)} high-severity issues (particularly in claim dependencies and technical enablement).")

    claims_issues = [i for i in issues if i.category == "claims"]
    if claims_issues:
        recs.append("Conduct an antecedent basis audit across all claims to ensure every 'the [term]' has prior 'a/at least one [term]' recitation.")

    recs.append("Replace vague relative degree qualifiers ('about', 'substantially') with concrete operating thresholds or empirical ranges.")
    recs.append("Cross-reference all figure callout numbers with the Detailed Description to guarantee full reference numeral synchronization.")

    return recs[:5]


def generate_executive_summary(
    title: str, score: float, verdict: str, issues: List[DraftIssue]
) -> str:
    """Generate an executive summary narrative for the review dashboard."""
    high_c = sum(1 for i in issues if i.severity == "High")
    med_c = sum(1 for i in issues if i.severity == "Medium")
    low_c = sum(1 for i in issues if i.severity == "Low")

    return (
        f"Automated patent draft audit for '{title}' evaluated an overall quality score of {score}/100 ({verdict}). "
        f"A total of {len(issues)} diagnostic observations were identified ({high_c} high-severity, {med_c} medium-severity, "
        f"and {low_c} minor refinements). Key areas requiring attention include clarifying technical limitation boundaries, "
        "harmonizing claim dependencies, and establishing unambiguous antecedent basis across all independent and dependent claims."
    )
