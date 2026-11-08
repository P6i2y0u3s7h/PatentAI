"""
Document Processing & Patent Section Segmentation Service.
Handles extraction from PDF and DOCX documents and segmenting patent drafts
into standard patent application sections and claims.
"""

import io
import logging
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Dict, List, Optional, Tuple

from app.core.exceptions import FileTooLargeError, PDFExtractionError, UnsupportedFileTypeError
from app.services.pdf_service import extract_text_from_pdf

logger = logging.getLogger(__name__)

STANDARD_SECTIONS = [
    "Title of Invention",
    "Abstract",
    "Background",
    "Summary of Invention",
    "Detailed Description",
    "Claims",
    "Drawings and References",
]


def extract_text_from_docx(file_bytes: bytes, filename: str = "") -> str:
    """
    Extract plain text from a DOCX document using standard library zipfile and XML parser.
    Works natively with zero external dependencies.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            if "word/document.xml" not in z.namelist():
                raise UnsupportedFileTypeError(
                    "The uploaded file is not a valid Microsoft Word (.docx) document."
                )

            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

            paragraphs: List[str] = []
            for p in tree.iterfind(".//w:p", ns):
                texts = [t.text for t in p.iterfind(".//w:t", ns) if t.text]
                if texts:
                    paragraph_str = "".join(texts).strip()
                    if paragraph_str:
                        paragraphs.append(paragraph_str)

            full_text = "\n\n".join(paragraphs).strip()
            if len(full_text) < 20:
                raise PDFExtractionError(
                    "The DOCX document is empty or contains insufficient text for patent analysis."
                )

            logger.info(
                "[DOCX] Successfully extracted %d characters from '%s'",
                len(full_text),
                filename or "document.docx",
            )
            return full_text

    except (UnsupportedFileTypeError, PDFExtractionError):
        raise
    except Exception as exc:
        logger.error("[DOCX] Extraction error for '%s': %s", filename, exc)
        raise PDFExtractionError(f"Could not read DOCX document: {exc}")


def extract_document_text(file_bytes: bytes, filename: str) -> str:
    """
    Unified extraction router: handles .pdf, .docx, and fallback text formats.
    """
    fname = filename.lower()
    if fname.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes, filename)
    elif fname.endswith(".docx"):
        return extract_text_from_docx(file_bytes, filename)
    elif fname.endswith(".txt") or fname.endswith(".doc"):
        try:
            return file_bytes.decode("utf-8", errors="replace").strip()
        except Exception as exc:
            raise UnsupportedFileTypeError(f"Unsupported text format: {exc}")
    else:
        # Check if it starts with %PDF magic bytes
        if file_bytes.startswith(b"%PDF"):
            return extract_text_from_pdf(file_bytes, filename)
        # Check if it's a zip/docx file
        if file_bytes.startswith(b"PK\x03\x04"):
            return extract_text_from_docx(file_bytes, filename)
        # Fallback to UTF-8 text decode
        try:
            decoded = file_bytes.decode("utf-8", errors="replace").strip()
            if len(decoded) > 30:
                return decoded
        except Exception:
            pass
        raise UnsupportedFileTypeError(
            f"Unsupported document format '{filename}'. Please upload a PDF (.pdf) or Word document (.docx)."
        )


def segment_patent_draft(raw_text: str) -> Dict[str, str]:
    """
    Segment raw patent text into standard sections:
    - Title of Invention
    - Abstract
    - Background
    - Summary of Invention
    - Detailed Description
    - Claims
    - Drawings and References
    """
    text = raw_text.strip()
    sections: Dict[str, str] = {s: "" for s in STANDARD_SECTIONS}

    # Section header patterns
    patterns = {
        "Abstract": r"(?i)(?:^|\n)\s*(?:abstract|abstract of the disclosure)\s*[:\n\-—]",
        "Background": r"(?i)(?:^|\n)\s*(?:background|background of the invention|prior art|technical field and background)\s*[:\n\-—]",
        "Summary of Invention": r"(?i)(?:^|\n)\s*(?:summary|summary of the invention|brief summary)\s*[:\n\-—]",
        "Drawings and References": r"(?i)(?:^|\n)\s*(?:brief description of the drawings|description of the drawings|drawings|reference numerals)\s*[:\n\-—]",
        "Detailed Description": r"(?i)(?:^|\n)\s*(?:detailed description|detailed description of embodiments|detailed description of the invention|description of embodiments)\s*[:\n\-—]",
        "Claims": r"(?i)(?:^|\n)\s*(?:claims|what is claimed is|we claim|patent claims)\s*[:\n\-—]",
    }

    # Find matches and indices
    positions: List[Tuple[str, int, int]] = []
    for section_name, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            positions.append((section_name, match.start(), match.end()))

    # Sort by start index
    positions.sort(key=lambda x: x[1])

    # Extract title if present before the first section
    if positions:
        first_pos = positions[0][1]
        preamble = text[:first_pos].strip()
        lines = [l.strip() for l in preamble.splitlines() if l.strip()]
        if lines:
            # First non-trivial line often contains title
            for line in lines:
                cleaned = re.sub(r"(?i)^(title|title of invention)\s*[:\n\-—]\s*", "", line).strip()
                if 5 < len(cleaned) < 250:
                    sections["Title of Invention"] = cleaned
                    break
            if not sections["Title of Invention"] and lines:
                sections["Title of Invention"] = lines[0]
    else:
        # No standard headers found; try first line as title
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if lines:
            sections["Title of Invention"] = lines[0]

    # Slice out sections between header positions
    for i, (name, _, end_idx) in enumerate(positions):
        next_start = positions[i + 1][1] if i + 1 < len(positions) else len(text)
        chunk = text[end_idx:next_start].strip()
        sections[name] = chunk

    # If Claims wasn't matched explicitly, check for numbered claim paragraphs (e.g. "1. A system...")
    if not sections["Claims"]:
        claim_match = re.search(r"(?:\n|^)\s*1\.\s+(?:A|An|The)\s+[\w\s]+(?:comprising|consisting)", text)
        if claim_match:
            sections["Claims"] = text[claim_match.start():].strip()

    # If Detailed Description is empty but there is large text after Background/Summary
    if not sections["Detailed Description"] and not sections["Summary of Invention"]:
        # Put body of text in Detailed Description
        if len(text) > 100:
            sections["Detailed Description"] = text

    return sections


def parse_claims(claims_text: str) -> List[Dict[str, any]]:
    """
    Extract individual claims from a claims section.
    Identifies claim numbers, independent vs dependent, parent dependency,
    and breaks independent claims into technical limitations/elements.
    """
    if not claims_text:
        return []

    # Clean leading 'Claims' header
    cleaned = re.sub(r"(?i)^\s*(?:claims|what is claimed is|we claim|patent claims)\s*[:\n\-—]*", "", claims_text).strip()

    # Split by claim numbering pattern e.g. "1.", "Claim 1:", "2."
    claim_splits = re.split(r"(?:\n|^)\s*(?:(?:claim\s+)?(\d+)[\.\:\-\s]+(?=[A-Z]))", "\n" + cleaned, flags=re.IGNORECASE)

    raw_claims: List[Tuple[int, str]] = []
    if len(claim_splits) > 1:
        # Pattern creates: [preamble, "1", text1, "2", text2, ...]
        i = 1
        while i < len(claim_splits) - 1:
            try:
                num = int(claim_splits[i])
                body = claim_splits[i + 1].strip()
                if body:
                    raw_claims.append((num, body))
            except Exception:
                pass
            i += 2
    else:
        # Fallback line-by-line regex
        lines = cleaned.split("\n\n")
        num = 1
        for block in lines:
            blk = block.strip()
            if not blk:
                continue
            m = re.match(r"^(?:claim\s+)?(\d+)[\.\:]?\s*(.+)$", blk, re.DOTALL | re.IGNORECASE)
            if m:
                raw_claims.append((int(m.group(1)), m.group(2).strip()))
            elif len(blk) > 20:
                raw_claims.append((num, blk))
                num += 1

    parsed: List[Dict[str, any]] = []
    for c_num, c_body in raw_claims:
        # Check if dependent
        dep_match = re.search(r"(?i)(?:of|according to|in)\s+claim\s+(\d+)", c_body)
        is_dependent = bool(dep_match)
        parent = f"Claim {dep_match.group(1)}" if dep_match else None

        # Decompose elements
        elements = decompose_claim_elements(c_num, c_body, is_dependent)

        parsed.append({
            "number": c_num,
            "claim_label": f"Claim {c_num}",
            "text": c_body,
            "is_dependent": is_dependent,
            "parent_claim": parent,
            "elements": elements,
        })

    return parsed


def decompose_claim_elements(claim_num: int, claim_text: str, is_dependent: bool) -> List[Dict[str, any]]:
    """
    Break a claim into structural elements: Preamble + technical limitations.
    Standard patent structure:
    Preamble -> transitional phrase ("comprising", "consisting of") -> clauses separated by semicolons or letters.
    """
    elements: List[Dict[str, any]] = []

    # Check for transition phrases
    trans_match = re.search(r"(?i)\b(comprising|comprises|consisting of|consisting essentially of|configured to)\b", claim_text)
    if trans_match:
        preamble = claim_text[:trans_match.end()].strip()
        body = claim_text[trans_match.end():].strip()
    else:
        preamble = ""
        body = claim_text

    if preamble:
        elements.append({
            "id": f"{claim_num}.0",
            "is_preamble": True,
            "text": preamble,
        })

    # Split body by semicolons, bullet letters (a), (b), or clauses
    raw_clauses = re.split(r";\s*(?:and\s+)?|\n\s*(?:\([a-z0-9]+\)|[a-z]\))\s*", body)
    if len(raw_clauses) <= 1:
        # Try splitting by commas followed by "wherein" or "configured to"
        raw_clauses = re.split(r",\s+(?=(?:wherein|further comprising|configured to|adapted to))", body)

    clause_idx = 1
    for cl in raw_clauses:
        cleaned_cl = cl.strip().rstrip(".;,")
        # Remove leading bullets
        cleaned_cl = re.sub(r"^(?:\([a-z0-9]+\)|[a-z]\))\s*", "", cleaned_cl).strip()
        if len(cleaned_cl) > 10:
            elements.append({
                "id": f"{claim_num}.{clause_idx}",
                "is_preamble": False,
                "text": cleaned_cl,
            })
            clause_idx += 1

    if not elements:
        elements.append({
            "id": f"{claim_num}.1",
            "is_preamble": False,
            "text": claim_text,
        })

    return elements
