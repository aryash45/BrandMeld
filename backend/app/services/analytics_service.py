"""
services/analytics_service.py — Engagement data aggregation.

Reads from published_posts + engagement_metrics Supabase tables.
Generates insights via simple rule-based analysis (Gemini in Phase 2).
Engagement sync from LinkedIn API is triggered on demand (Phase 2: periodic job).
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.config import get_settings
from app.models.analytics import (
    AnalyticsSummaryResponse,
    EngagementSummary,
    TopPost,
    PlatformStats,
    EngagementDataPoint,
)
from app.shared.db import get_supabase_client

logger = logging.getLogger(__name__)



async def get_analytics_summary(
    user_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    platform: Optional[str] = None,
) -> AnalyticsSummaryResponse:
    """
    Build the full analytics summary for the dashboard.
    Falls back to empty response if Supabase is not configured.
    """
    sb = get_supabase_client()
    if not sb:
        return _empty_summary()

    if not from_date:
        from_date = datetime.now(timezone.utc) - timedelta(days=30)
    if not to_date:
        to_date = datetime.now(timezone.utc)

    # ── Fetch published posts ─────────────────────────────────────────────
    q = (
        sb.table("published_posts")
        .select("id, platform, content, published_at, campaign_id")
        .eq("user_id", user_id)
        .gte("published_at", from_date.isoformat())
        .lte("published_at", to_date.isoformat())
        .neq("status", "failed")
    )
    if platform:
        q = q.eq("platform", platform)
    posts_result = q.execute()
    posts = posts_result.data or []

    if not posts:
        return _empty_summary()

    post_ids = [p["id"] for p in posts]

    # ── Fetch engagement metrics ──────────────────────────────────────────
    metrics_result = (
        sb.table("engagement_metrics")
        .select("*")
        .in_("post_id", post_ids)
        .execute()
    )
    metrics_by_post: dict[str, dict] = {
        m["post_id"]: m for m in (metrics_result.data or [])
    }

    # ── Aggregate ─────────────────────────────────────────────────────────
    total_likes = 0
    total_retweets = 0
    total_impressions = 0
    platform_data: dict[str, dict] = {}
    top_posts_raw: list[dict] = []

    for post in posts:
        m = metrics_by_post.get(post["id"], {})
        likes = m.get("likes_count", 0)
        retweets = m.get("retweets_count", 0)
        impressions = m.get("impressions_count", 0)
        total_likes += likes
        total_retweets += retweets
        total_impressions += impressions

        plat = post["platform"]
        if plat not in platform_data:
            platform_data[plat] = {"impressions": 0, "likes": 0, "retweets": 0, "replies": 0, "shares": 0}
        platform_data[plat]["impressions"] += impressions
        platform_data[plat]["likes"] += likes
        platform_data[plat]["retweets"] += retweets
        platform_data[plat]["replies"] += m.get("replies_count", 0)
        platform_data[plat]["shares"] += m.get("shares_count", 0)

        engagement_rate = round((likes + retweets) / impressions * 100, 2) if impressions else 0
        top_posts_raw.append({
            "post_id": post["id"],
            "platform": plat,
            "content_preview": post["content"][:80],
            "published_at": post["published_at"],
            "likes": likes,
            "retweets": retweets,
            "impressions": impressions,
            "engagement_rate": engagement_rate,
        })

    n = len(posts)
    avg_er = round(total_likes / total_impressions * 100, 2) if total_impressions else 0

    top_posts_sorted = sorted(top_posts_raw, key=lambda x: x["likes"] + x["retweets"], reverse=True)[:5]

    top_posts = [TopPost(**p) for p in top_posts_sorted]
    platform_breakdown = {k: PlatformStats(**v) for k, v in platform_data.items()}

    insights = _generate_insights(top_posts_raw, platform_data)

    return AnalyticsSummaryResponse(
        summary=EngagementSummary(
            posts_published=n,
            total_impressions=total_impressions,
            total_likes=total_likes,
            total_retweets=total_retweets,
            avg_engagement_rate=avg_er,
        ),
        top_posts=top_posts,
        platform_breakdown=platform_breakdown,
        insights=insights,
    )


def _generate_insights(posts: list[dict], platform_data: dict) -> list[str]:
    """Simple rule-based insight generation (Phase 1). Gemini-powered in Phase 2."""
    insights: list[str] = []

    if not posts:
        return ["Publish your first posts to start seeing insights."]

    # Best platform
    best_plat = max(platform_data, key=lambda k: platform_data[k]["likes"], default=None)
    if best_plat and len(platform_data) > 1:
        insights.append(f"Your {best_plat} posts get the most engagement — double down there.")

    # Engagement rate benchmark
    avg_er = sum(p["engagement_rate"] for p in posts) / len(posts)
    if avg_er > 3:
        insights.append(f"Your average {avg_er:.1f}% engagement rate is above industry average (1–2%).")
    elif avg_er < 1:
        insights.append("Low engagement rate. Try shorter, more opinionated posts.")

    # Posting frequency
    if len(posts) < 4:
        insights.append("Post at least 4x / month to build consistent momentum.")

    return insights[:4]


def _empty_summary() -> AnalyticsSummaryResponse:
    return AnalyticsSummaryResponse(
        summary=EngagementSummary(),
        insights=["Publish your first posts to start seeing analytics."],
    )
