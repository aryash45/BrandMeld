"""
routers/marketplace.py — Voice Marketplace + Campaign Angle Templates.

GET  /v1/marketplace/voices           — List voices
GET  /v1/marketplace/voices/:id       — Voice detail
POST /v1/marketplace/voices/:id/fork  — Fork into user's brand DNA
POST /v1/marketplace/voices/:id/rate  — Rate a voice (1–5)
GET  /v1/marketplace/templates        — Angle templates (static)
"""
from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.marketplace import MarketplaceListResponse, ForkRequest, ForkResponse, AngleTemplate
from app.services import marketplace_service
from app.shared.deps import get_user_id
from app.shared.db import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/voices", response_model=MarketplaceListResponse)
async def list_voices(
    request: Request,
    category: Optional[str] = Query(default=None),
    sort: str = Query(default="trending", pattern="^(trending|top_rated|newest)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=50),
):
    """List marketplace voices with optional filtering and sorting."""
    get_user_id(request)
    return await marketplace_service.list_voices(
        category=category, sort=sort, page=page, limit=limit
    )


@router.get("/voices/{voice_id}")
async def get_voice_detail(voice_id: str, request: Request):
    """Get full voice profile including sample posts and comments."""
    get_user_id(request)
    voice = await marketplace_service.get_voice(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    return {"voice": voice}


@router.post("/voices/{voice_id}/fork", response_model=ForkResponse, status_code=201)
async def fork_voice(voice_id: str, req: ForkRequest, request: Request):
    """Fork a marketplace voice into the authenticated user's Brand DNA."""
    user_id = get_user_id(request)
    return await marketplace_service.fork_voice(user_id, voice_id, req.customizations)


class RateRequest(BaseModel):
    model_config = {"extra": "forbid"}
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=500)


@router.post("/voices/{voice_id}/rate", status_code=201)
async def rate_voice(voice_id: str, req: RateRequest, request: Request):
    """Submit a 1–5 star rating for a marketplace voice."""
    user_id = get_user_id(request)
    sb = get_supabase_client()
    if not sb:
        return {"success": True, "note": "Rating not persisted (DB not configured)"}
    voice = sb.table("voice_marketplace_entries").select("id").eq("id", voice_id).eq("is_public", True).maybe_single().execute()
    if not voice.data:
        raise HTTPException(status_code=404, detail="Voice not found")
    if req.comment:
        sb.table("voice_marketplace_comments").insert({
            "voice_entry_id": voice_id,
            "user_id": user_id,
            "comment_text": req.comment,
            "rating": req.rating,
        }).execute()

    # Recalculate average rating
    ratings_r = (
        sb.table("voice_marketplace_comments")
        .select("rating")
        .eq("voice_entry_id", voice_id)
        .execute()
    )
    ratings = [r["rating"] for r in (ratings_r.data or []) if r.get("rating")]
    if ratings:
        avg = sum(ratings) / len(ratings)
        sb.table("voice_marketplace_entries").update({
            "rating": round(avg, 2),
            "rating_count": len(ratings),
        }).eq("id", voice_id).execute()

    return {"success": True}


@router.get("/templates", response_model=list[AngleTemplate])
async def get_angle_templates(
    request: Request,
    category: Optional[str] = Query(default=None),
):
    """Return campaign angle templates, optionally filtered by category."""
    get_user_id(request)
    return marketplace_service.get_angle_templates(category)
