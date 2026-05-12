"""
routers/analytics.py — Engagement analytics endpoints.

GET /v1/analytics            — Full summary (top posts, breakdown, insights)
GET /v1/analytics/post/:id   — Single post engagement detail
"""
from __future__ import annotations
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Request, Query, HTTPException

from app.models.analytics import AnalyticsSummaryResponse
from app.services import analytics_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


def _user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


@router.get("", response_model=AnalyticsSummaryResponse)
async def get_analytics(
    request: Request,
    from_date: Optional[datetime] = Query(default=None, description="ISO datetime, default: 30 days ago"),
    to_date: Optional[datetime] = Query(default=None, description="ISO datetime, default: now"),
    platform: Optional[str] = Query(default=None, description="Filter by platform"),
):
    """
    Return engagement summary, top posts, platform breakdown, and insights
    for the authenticated user.
    """
    user_id = _user_id(request)
    return await analytics_service.get_analytics_summary(
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        platform=platform,
    )


@router.get("/post/{post_id}")
async def get_post_analytics(post_id: str, request: Request):
    """Return engagement detail for a single published post."""
    user_id = _user_id(request)
    from app.config import get_settings
    from supabase import create_client

    s = get_settings()
    if not s.supabase_url:
        raise HTTPException(status_code=503, detail="DB not configured")

    sb = create_client(s.supabase_url, s.supabase_service_role_key)

    post_r = (
        sb.table("published_posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not post_r.data:
        raise HTTPException(status_code=404, detail="Post not found")

    metrics_r = (
        sb.table("engagement_metrics")
        .select("*")
        .eq("post_id", post_id)
        .maybe_single()
        .execute()
    )

    return {
        "post": post_r.data,
        "engagement": metrics_r.data or {},
    }
