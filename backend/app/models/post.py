"""models/post.py — Published post and engagement models."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PublishedPost(BaseModel):
    id: str
    user_id: str
    campaign_id: Optional[str] = None
    content: str
    platform: str  # 'twitter' | 'linkedin' | 'email'
    platform_post_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    published_at: datetime
    status: str = "published"  # draft | scheduled | published | failed
    error_message: Optional[str] = None
    created_at: datetime


class EngagementMetric(BaseModel):
    post_id: str
    likes_count: int = 0
    retweets_count: int = 0
    replies_count: int = 0
    shares_count: int = 0
    clicks_count: int = 0
    opens_count: int = 0
    impressions_count: int = 0
    updated_at: datetime


class PublishRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    campaign_id: str
    content: dict[str, str] = Field(max_length=4)  # {platform: draft_text}
    platforms: list[str] = Field(min_length=1, max_length=4)
    schedule_at: Optional[datetime] = None


class PublishResponse(BaseModel):
    published_post_ids: dict[str, str] = Field(default_factory=dict)
    twitter_intent_url: Optional[str] = None  # Phase 1: X intent link
    scheduled: bool = False
    success: bool
    message: str = ""
    errors: dict[str, str] = Field(default_factory=dict)
