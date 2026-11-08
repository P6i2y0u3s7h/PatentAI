"""
Pydantic models for request validation and response serialization.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Patent Search ─────────────────────────────────────────────────────────────


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=10, max_length=10_000, description="Patent text to search against")
    top_k: int = Field(default=10, ge=1, le=50, description="Number of results to return")

    @field_validator("query")
    @classmethod
    def clean_query(cls, v: str) -> str:
        return v.strip()


class PatentResult(BaseModel):
    id: str
    title: str
    abstract: str
    description: str
    assignee: str
    publication_date: str
    country: str
    ipc_class: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    matching_keywords: list[str] = []
    snippet: str = ""


class SearchResponse(BaseModel):
    results: list[PatentResult]
    query_length: int
    total_found: int
    search_time_ms: float


# ── Summarization ─────────────────────────────────────────────────────────────


class SummaryRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=100_000, description="Text to summarize")

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 5:
            raise ValueError("Text must be at least 5 characters long to summarize.")
        return stripped


class SummaryResponse(BaseModel):
    summary: str
    original_length: int
    summary_length: int
    processing_time_ms: float


# ── Search History ────────────────────────────────────────────────────────────


class HistoryEntry(BaseModel):
    id: str
    user_id: str
    query_snippet: str
    top_result_title: Optional[str] = None
    top_result_score: Optional[float] = None
    result_count: int
    created_at: datetime
    source: str = "text"  # "text" | "pdf"


class HistoryResponse(BaseModel):
    entries: list[HistoryEntry]
    total: int


class DeleteHistoryResponse(BaseModel):
    deleted_id: str
    success: bool


# ── Authentication ────────────────────────────────────────────────────────────


class VerifyTokenRequest(BaseModel):
    token: str = Field(..., description="Firebase ID token")


class VerifyTokenResponse(BaseModel):
    uid: str
    email: Optional[str]
    valid: bool


# ── Health ────────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    version: str
    faiss_loaded: bool
    embedding_model_loaded: bool
    summarization_model_loaded: bool
    firebase_connected: bool
    uptime_seconds: float


# ── AI Patent Assistant ──────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' | 'assistant' | 'system'")
    content: str = Field(..., description="Message text content")
    timestamp: Optional[str] = None
    sources: list[str] = Field(default_factory=list, description="Citations or referenced sections")


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=20000, description="User question or prompt")
    chat_id: Optional[str] = Field(default=None, description="Active chat session ID")
    doc_context: Optional[str] = Field(default=None, description="Extracted text or document content")
    doc_name: Optional[str] = Field(default=None, description="Uploaded document filename")
    history: list[ChatMessage] = Field(default_factory=list, description="Recent conversation turns")

    @field_validator("message")
    @classmethod
    def clean_message(cls, v: str) -> str:
        return v.strip()


class AssistantChatResponse(BaseModel):
    response: str
    chat_id: str
    title: str
    sources: list[str] = []
    processing_time_ms: float


class AssistantSession(BaseModel):
    id: str
    user_id: str
    title: str
    doc_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_message: Optional[str] = None


class AssistantHistoryResponse(BaseModel):
    sessions: list[AssistantSession]
    total: int


class AssistantRenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120, description="New title for chat session")


class AssistantSessionDetailResponse(BaseModel):
    session: AssistantSession
    messages: list[ChatMessage]


class AssistantPdfUploadResponse(BaseModel):
    filename: str
    doc_context: str
    char_count: int
    word_count: int
    page_count: int
    summary: str


# ── Patent Comparison ────────────────────────────────────────────────────────


class PatentCompareRequest(BaseModel):
    patent_a_id: str = Field(..., description="ID of first patent, e.g. US-2024-001")
    patent_b_id: str = Field(..., description="ID of second patent, e.g. US-2024-002")


class PatentFeatureComparison(BaseModel):
    parameter: str
    patent_a: str
    patent_b: str


class PatentComparisonResponse(BaseModel):
    patent_a: PatentResult
    patent_b: PatentResult
    similarity_percentage: float
    parameters_table: list[PatentFeatureComparison]
    similarities: list[str]
    differences: list[str]
    common_features: list[str]
    unique_features_a: list[str]
    unique_features_b: list[str]
    methodology_comparison: str
    claims_comparison: str
    technical_advantages_a: list[str]
    technical_advantages_b: list[str]
    summary: str
    processing_time_ms: float


class ComparisonHistoryEntry(BaseModel):
    id: str
    user_id: str
    patent_a_id: str
    patent_a_title: str
    patent_b_id: str
    patent_b_title: str
    similarity_percentage: float
    created_at: datetime


class ComparisonHistoryResponse(BaseModel):
    entries: list[ComparisonHistoryEntry]
    total: int


# ── AI Patent Novelty Analysis ───────────────────────────────────────────────


class NoveltyAnalysisRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=500, description="Invention title")
    description: str = Field(..., min_length=20, max_length=50000, description="Detailed invention description")
    technical_details: Optional[str] = Field(default="", max_length=50000, description="Technical approach, architecture, implementation")
    claims: Optional[str] = Field(default="", max_length=50000, description="Proposed patent claims")


class NoveltyOverview(BaseModel):
    novelty_score: float = Field(..., ge=0.0, le=100.0, description="Novelty potential score (0-100)")
    novelty_verdict: str = Field(..., description="E.g. High Novelty Potential, Moderate Overlap, Prior-Art Risk")
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    relevant_patents_count: int
    most_relevant_patent_id: str
    most_relevant_patent_title: str
    highest_similarity_score: float


class TechnicalFeatureAnalysis(BaseModel):
    disclosed_features: list[str] = Field(default_factory=list, description="Features already disclosed in retrieved patents")
    distinguishing_features: list[str] = Field(default_factory=list, description="Potentially novel/distinguishing technical features")
    similar_technical_approaches: list[str] = Field(default_factory=list, description="Similar methodologies found in prior art")
    potential_overlaps: list[str] = Field(default_factory=list, description="Potential technical overlap areas")


class NoveltyPatentReference(BaseModel):
    id: str
    title: str
    abstract: str
    similarity_percentage: float
    relevant_features: list[str]
    assignee: str
    publication_date: str
    ipc_class: str


class AIRecommendations(BaseModel):
    areas_for_investigation: list[str]
    distinguishing_features_guidance: list[str]
    suggested_prior_art_searches: list[str]


class NoveltyAnalysisResponse(BaseModel):
    id: str
    title: str
    overview: NoveltyOverview
    technical_features: TechnicalFeatureAnalysis
    prior_art_references: list[NoveltyPatentReference]
    recommendations: AIRecommendations
    final_summary: str
    disclaimer: str
    created_at: datetime
    processing_time_ms: float


class NoveltyHistoryEntry(BaseModel):
    id: str
    user_id: str
    title: str
    novelty_verdict: str
    highest_similarity_score: float
    relevant_patents_count: int
    created_at: datetime


class NoveltyHistoryResponse(BaseModel):
    entries: list[NoveltyHistoryEntry]
    total: int


# ── 1. AI Patent Draft Reviewer Models ─────────────────────────────────────────


class DraftIssue(BaseModel):
    id: str
    title: str
    original_text: str = Field(default="", description="Verbatim snippet from draft with issue")
    explanation: str = Field(..., description="Why this constitutes a potential issue")
    severity: str = Field(..., description="'High', 'Medium', or 'Low'")
    category: str = Field(..., description="'technical', 'structure', 'claims', or 'missing_info'")
    suggested_improvement: str = Field(..., description="Actionable improved wording or limitation")
    reason: str = Field(..., description="Technical or legal drafting rationale")


class DraftSectionStatus(BaseModel):
    section_name: str
    present: bool
    status: str = Field(..., description="'Complete', 'Needs Improvement', or 'Missing'")
    details: str


class DraftReviewResponse(BaseModel):
    id: str
    user_id: str
    title: str
    technical_field: str
    review_type: str
    quality_score: float = Field(..., ge=0.0, le=100.0, description="AI-generated draft quality indicator (0-100)")
    score_verdict: str
    sections: list[DraftSectionStatus]
    issues: list[DraftIssue]
    technical_issues_count: int
    structure_issues_count: int
    claims_issues_count: int
    missing_info_count: int
    overall_summary: str
    recommendations: list[str]
    disclaimer: str
    created_at: str
    processing_time_ms: float


class DraftReviewHistoryEntry(BaseModel):
    id: str
    user_id: str
    title: str
    technical_field: str
    quality_score: float
    issue_count: int
    created_at: str


class DraftReviewHistoryResponse(BaseModel):
    entries: list[DraftReviewHistoryEntry]
    total: int


# ── 2. Interactive Patent Similarity Network Models ────────────────────────────


class NetworkNode(BaseModel):
    id: str
    title: str
    abstract: str
    assignee: str
    publication_date: str
    ipc_class: str
    category: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    shared_concepts: list[str] = Field(default_factory=list)
    source_url: str
    is_central: bool = False


class NetworkEdge(BaseModel):
    source: str
    target: str
    similarity: float = Field(..., ge=0.0, le=1.0)
    label: str = ""
    shared_keywords: list[str] = Field(default_factory=list)


class PatentNetworkResponse(BaseModel):
    id: str
    user_id: str
    central_patent_id: str
    central_title: str
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
    categories: list[str]
    total_nodes: int
    total_edges: int
    avg_similarity: float
    created_at: str
    processing_time_ms: float


class PatentNetworkHistoryEntry(BaseModel):
    id: str
    user_id: str
    central_patent_id: str
    central_title: str
    node_count: int
    created_at: str


class PatentNetworkHistoryResponse(BaseModel):
    entries: list[PatentNetworkHistoryEntry]
    total: int


# ── 3. AI Claim Chart Generator Models ─────────────────────────────────────────


class ClaimElementComparison(BaseModel):
    claim_number: str
    element_id: str
    element_text: str
    is_preamble: bool = False
    parent_claim: Optional[str] = None
    evidence_text: str
    evidence_source: str
    match_status: str = Field(..., description="'Match', 'Partial Match', 'Not Found', or 'Requires Manual Review'")
    explanation: str


class ClaimChartResponse(BaseModel):
    id: str
    user_id: str
    title: str
    doc_a_name: str
    doc_b_name: str
    doc_a_type: str = "Patent Claims"
    doc_b_type: str = "Comparison Document"
    elements: list[ClaimElementComparison]
    total_elements: int
    matches_count: int
    partial_matches_count: int
    not_found_count: int
    requires_review_count: int
    coverage_score: float = Field(..., ge=0.0, le=100.0, description="Percentage of claims with evidence mapped")
    summary_analysis: str
    risk_level: str
    recommendations: list[str]
    disclaimer: str
    created_at: str
    processing_time_ms: float


class ClaimChartHistoryEntry(BaseModel):
    id: str
    user_id: str
    title: str
    doc_a_name: str
    doc_b_name: str
    coverage_score: float
    total_elements: int
    created_at: str


class ClaimChartHistoryResponse(BaseModel):
    entries: list[ClaimChartHistoryEntry]
    total: int


