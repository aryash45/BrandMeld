"""
routers/prompts.py — Weekly Prompt Engine endpoints.

GET  /v1/prompts/weekly             — Get current unanswered prompt
POST /v1/prompts/weekly/:id/answer  — Submit answer (optionally generate campaign)
GET  /v1/prompts/history            — List past answered prompts
"""
from __future__ import annotations
import logging

from fastapi import APIRouter, Request, HTTPException, Query

from app.models.marketplace import WeeklyPrompt, AnswerPromptRequest
from app.services import prompt_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prompts", tags=["prompts"])


def _user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


@router.get("/weekly", response_model=WeeklyPrompt)
async def get_weekly_prompt(request: Request):
    """
    Return the current unanswered weekly prompt for this user.
    Creates a new one if none exists.
    """
    user_id = _user_id(request)
    prompt = await prompt_service.get_current_prompt(user_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="No prompt found")
    return prompt


@router.post("/weekly/{prompt_id}/answer", status_code=201)
async def answer_prompt(prompt_id: str, req: AnswerPromptRequest, request: Request):
    """
    Save the user's answer to a weekly prompt.
    If generate_campaign=True, the answer becomes the campaign brief
    and drafts are generated immediately.
    """
    user_id = _user_id(request)
    await prompt_service.answer_prompt(user_id, prompt_id, req.answer_text)

    if not req.generate_campaign:
        return {"prompt_id": prompt_id, "success": True}

    # Auto-generate campaign from answer
    # generate_content_batch is extracted from engine.py in Phase 3.
    # For now, return the answer without generating drafts.
    try:
        from app.services.engine import generate_content_batch as _gcb  # type: ignore
        results = await _gcb(
            content_request=req.answer_text,
            brand_voice="",
            platforms=["twitter", "linkedin"],
        )
    except (ImportError, AttributeError):
        return {"prompt_id": prompt_id, "success": True, "note": "Campaign generation available in Phase 3"}

    # Save campaign
    from app.config import get_settings
    from supabase import create_client
    s = get_settings()
    campaign_id = None
    if s.supabase_url:
        sb = create_client(s.supabase_url, s.supabase_service_role_key)
        camp_r = sb.table("campaigns").insert({
            "user_id": user_id,
            "brief_what_changed": req.answer_text,
            "generated_drafts": results,
            "status": "draft",
            "selected_platforms": list(results.keys()),
        }).execute()
        if camp_r.data:
            campaign_id = camp_r.data[0]["id"]
            sb.table("weekly_prompts").update(
                {"created_campaign_id": campaign_id}
            ).eq("id", prompt_id).execute()

    return {
        "prompt_id": prompt_id,
        "campaign_id": campaign_id,
        "drafts": results,
        "success": True,
    }


@router.get("/history")
async def get_prompt_history(
    request: Request,
    limit: int = Query(default=10, ge=1, le=50),
):
    """Return list of past answered prompts for this user."""
    user_id = _user_id(request)
    history = await prompt_service.get_prompt_history(user_id, limit)
    return {"prompts": history}
