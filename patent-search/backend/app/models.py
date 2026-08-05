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
    text: str = Field(..., min_length=50, max_length=50_000, description="Text to summarize")

    @field_validator("text")
    @classmethod
    def clean_text(cls, v: str) -> str:
        return v.strip()


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
