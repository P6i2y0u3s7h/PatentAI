"""
AI Patent Assistant Router: ChatGPT-like conversational intelligence,
document RAG, PDF ingestion, and user session management.
"""

import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.dependencies import get_current_user
from app.models import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantHistoryResponse,
    AssistantPdfUploadResponse,
    AssistantRenameRequest,
    AssistantSessionDetailResponse,
    ChatMessage,
    DeleteHistoryResponse,
)
from app.services import assistant_service, llm_service, pdf_service
from app.utils import clean_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["AI Patent Assistant"])


@router.post("/chat", response_model=AssistantChatResponse, summary="Send Message to AI Patent Assistant")
async def chat_with_assistant(
    body: AssistantChatRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> AssistantChatResponse:
    """
    Submit a prompt/question to the AI Patent Assistant.
    Supports RAG queries over uploaded patent documents, general patent law/prior-art,
    and multi-turn chat history.
    """
    start_ms = time.perf_counter() * 1000
    cleaned_msg = clean_text(body.message)

    if not cleaned_msg:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty.",
        )

    logger.info(
        "[ASSISTANT] message from uid='%s', chat_id='%s', doc_name='%s'",
        user.get("uid"),
        body.chat_id,
        body.doc_name,
    )

    # Convert history models to dicts
    history_dicts = [m.model_dump() for m in body.history] if body.history else []

    response_text, sources = await llm_service.answer_assistant_query(
        query=cleaned_msg,
        doc_context=body.doc_context,
        history=history_dicts,
    )

    elapsed_ms = (time.perf_counter() * 1000) - start_ms

    # Persist session to Firestore
    saved_chat_id, title = assistant_service.save_assistant_message(
        user_id=user["uid"],
        chat_id=body.chat_id,
        user_message=cleaned_msg,
        assistant_response=response_text,
        sources=sources,
        doc_name=body.doc_name,
        doc_context=body.doc_context,
    )

    return AssistantChatResponse(
        response=response_text,
        chat_id=saved_chat_id,
        title=title,
        sources=sources,
        processing_time_ms=round(elapsed_ms, 2),
    )


@router.post("/upload-pdf", response_model=AssistantPdfUploadResponse, summary="Upload Patent PDF for Assistant Context")
async def upload_pdf_for_assistant(
    file: UploadFile = File(..., description="Patent PDF document"),
    user: Annotated[dict, Depends(get_current_user)] = None,
) -> AssistantPdfUploadResponse:
    """
    Extract text and metadata from an uploaded patent PDF to use as grounding context
    for the AI Assistant.
    """
    filename = file.filename or "patent.pdf"
    file_bytes = await file.read()

    extracted_text = pdf_service.extract_text_from_pdf(file_bytes, filename)
    cleaned = clean_text(extracted_text)

    # Word count and quick summary
    words = cleaned.split()
    word_count = len(words)
    char_count = len(cleaned)

    # Quick summary of document beginning
    from app.services import summary_service
    summary = summary_service.summarize(cleaned[:4000])

    logger.info("[ASSISTANT] Ingested PDF '%s': %d chars, %d words", filename, char_count, word_count)

    return AssistantPdfUploadResponse(
        filename=filename,
        doc_context=cleaned,
        char_count=char_count,
        word_count=word_count,
        page_count=max(1, word_count // 350),
        summary=summary,
    )


@router.get("/history", response_model=AssistantHistoryResponse, summary="List User Chat Sessions")
async def get_assistant_history(
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 30,
) -> AssistantHistoryResponse:
    """Retrieve all saved chat sessions for the authenticated user."""
    sessions = assistant_service.get_user_chat_sessions(user["uid"], limit=limit)
    return AssistantHistoryResponse(sessions=sessions, total=len(sessions))


@router.get("/history/{chat_id}", response_model=AssistantSessionDetailResponse, summary="Get Full Chat Session")
async def get_assistant_chat_detail(
    chat_id: str,
    user: Annotated[dict, Depends(get_current_user)],
) -> AssistantSessionDetailResponse:
    """Retrieve messages and metadata for a specific chat session."""
    data = assistant_service.get_chat_session(chat_id, user["uid"])
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found or access denied.",
        )

    session = assistant_service.AssistantSession(
        id=data.get("id", chat_id),
        user_id=data.get("user_id", user["uid"]),
        title=data.get("title", "Untitled Chat"),
        doc_name=data.get("doc_name"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
        message_count=data.get("message_count", len(data.get("messages", []))),
        last_message=data.get("last_message"),
    )

    messages = [
        ChatMessage(
            role=m.get("role", "assistant"),
            content=m.get("content", ""),
            timestamp=m.get("timestamp"),
            sources=m.get("sources", []),
        )
        for m in data.get("messages", [])
    ]

    return AssistantSessionDetailResponse(session=session, messages=messages)


@router.delete("/history/{chat_id}", response_model=DeleteHistoryResponse, summary="Delete Chat Session")
async def delete_assistant_chat(
    chat_id: str,
    user: Annotated[dict, Depends(get_current_user)],
) -> DeleteHistoryResponse:
    """Delete a chat session."""
    deleted = assistant_service.delete_chat_session(chat_id, user["uid"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found or access denied.",
        )
    return DeleteHistoryResponse(deleted_id=chat_id, success=True)


@router.patch("/history/{chat_id}", summary="Rename Chat Session")
async def rename_assistant_chat(
    chat_id: str,
    body: AssistantRenameRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Rename a chat session."""
    renamed = assistant_service.rename_chat_session(chat_id, user["uid"], body.title)
    if not renamed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found or access denied.",
        )
    return {"id": chat_id, "title": body.title.strip(), "success": True}


