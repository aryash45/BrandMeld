"""models/analytics.py — Analytics response models."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class EngagementSummary(BaseModel):
    posts_published: int = 0
    total_impressions: int = 0
    total_likes: int = 0
    total_retweets: int = 0
    avg_engagement_rate: float = 0.0


class TopPost(BaseModel):
    post_id: str
    platform: str
    content_preview: str  # first 80 chars
    published_at: datetime
    likes: int = 0
    retweets: int = 0
    impressions: int = 0
    engagement_rate: float = 0.0


class PlatformStats(BaseModel):
    impressions: int = 0
    likes: int = 0
    retweets: int = 0
    replies: int = 0
    shares: int = 0
    opens: int = 0    # email only
    clicks: int = 0   # email only


class EngagementDataPoint(BaseModel):
    date: str  # YYYY-MM-DD
    impressions: int = 0
    likes: int = 0
    engagement_rate: float = 0.0


class AnalyticsSummaryResponse(BaseModel):
    summary: EngagementSummary
    top_posts: list[TopPost] = Field(default_factory=list)
    platform_breakdown: dict[str, PlatformStats] = Field(default_factory=dict)
    insights: list[str] = Field(default_factory=list)
    engagement_history: list[EngagementDataPoint] = Field(default_factory=list)


class AnalyticsEvent(BaseModel):
    user_id: str
    event_type: str
    event_data: Optional[dict] = None
    created_at: Optional[datetime] = None
