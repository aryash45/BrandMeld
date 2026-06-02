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
from app.shared.deps import get_user_id
from app.shared.db import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


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
    user_id = get_user_id(request)
    return await analytics_service.get_analytics_summary(
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        platform=platform,
    )


@router.get("/post/{post_id}")
async def get_post_analytics(post_id: str, request: Request):
    """Return engagement detail for a single published post."""
    user_id = get_user_id(request)
    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=503, detail="DB not configured")

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
