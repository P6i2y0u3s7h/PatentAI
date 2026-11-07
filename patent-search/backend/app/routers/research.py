"""
AI Patent Research Agent Router.
Provides endpoints for starting autonomous multi-step patent prior-art research,
monitoring real-time progress, retrieving final reports, asking follow-up questions,
and browsing research history.
"""

import asyncio
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user, get_optional_user
from app.services.pdf_service import extract_text_from_pdf
from app.services.research_agent_service import (
    answer_research_followup,
    create_research_task,
    delete_research_history,
    execute_research_workflow,
    get_research_history,
    get_task_results,
    get_task_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/research", tags=["AI Patent Research Agent"])


class FollowUpRequest(BaseModel):
    task_id: str = Field(..., description="ID of completed research task")
    question: str = Field(..., min_length=3, max_length=1500, description="Follow-up question for the research agent")


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start_research(
    invention_title: Annotated[str, Form(min_length=2, max_length=300)],
    invention_description: Annotated[str, Form(min_length=10, max_length=20000)],
    technical_field: Annotated[str, Form()] = "",
    key_technologies: Annotated[str, Form()] = "",
    research_objective: Annotated[str, Form()] = "",
    pdf_file: Annotated[Optional[UploadFile], File()] = None,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """
    Initiate an autonomous multi-step patent prior-art research task.
    Returns a task_id to poll progress via GET /api/research/status/{task_id}.
    """
    user_id = user.get("uid", "dev-user") if user else "dev-user"

    pdf_text = ""
    pdf_filename = ""
    if pdf_file and pdf_file.filename:
        pdf_filename = pdf_file.filename
        try:
            content = await pdf_file.read()
            if content:
                pdf_text = extract_text_from_pdf(content, filename=pdf_filename)
                logger.info("[RESEARCH ROUTER] Extracted %d chars from PDF '%s'", len(pdf_text), pdf_filename)
        except Exception as exc:
            logger.warning("[RESEARCH ROUTER] PDF extraction failed (%s), proceeding with text input only.", exc)

    task_id = create_research_task(
        user_id=user_id,
        invention_title=invention_title,
        invention_description=invention_description,
        technical_field=technical_field,
        key_technologies=key_technologies,
        research_objective=research_objective,
        pdf_text=pdf_text,
        pdf_filename=pdf_filename,
    )

    # Spawn asynchronous background agent workflow
    asyncio.create_task(execute_research_workflow(task_id))

    return {
        "task_id": task_id,
        "status": "pending",
        "message": "AI Patent Research Agent workflow initiated.",
    }


@router.get("/status/{task_id}")
async def get_status(
    task_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """Get live execution progress, active step, and streaming logs."""
    user_id = user.get("uid", "dev-user") if user else "dev-user"
    task_status = get_task_status(task_id, user_id)
    if not task_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research task '{task_id}' not found.",
        )
    return task_status


@router.get("/results/{task_id}")
async def get_results(
    task_id: str,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """Get full structured research results and complete markdown report."""
    user_id = user.get("uid", "dev-user") if user else "dev-user"
    results = get_task_results(task_id, user_id)
    if not results:
        # Check if task is still running
        status_info = get_task_status(task_id, user_id)
        if status_info and status_info["status"] in ("pending", "running"):
            return {
                "task_id": task_id,
                "status": status_info["status"],
                "progress_percent": status_info["progress_percent"],
                "message": "Research task is still in progress. Please continue polling.",
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research results for task '{task_id}' not found or task failed.",
        )
    return results


@router.post("/follow-up")
async def follow_up(
    request: FollowUpRequest,
    user: Annotated[Optional[dict], Depends(get_optional_user)] = None,
):
    """Ask a follow-up question grounded in the research report and cited patents."""
    user_id = user.get("uid", "dev-user") if user else "dev-user"
    response = await answer_research_followup(
        task_id=request.task_id,
        user_id=user_id,
        question=request.question,
    )
    return response


@router.get("/history")
async def get_history(
    user: Annotated[dict, Depends(get_current_user)],
):
    """Retrieve the authenticated user's research history."""
    user_id = user.get("uid", "dev-user")
    history_entries = get_research_history(user_id=user_id, limit=30)
    return history_entries


@router.delete("/{task_id}")
async def delete_history(
    task_id: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Delete a research task from user's history."""
    user_id = user.get("uid", "dev-user")
    success = delete_research_history(task_id=task_id, user_id=user_id)
    return {"success": success, "task_id": task_id}

