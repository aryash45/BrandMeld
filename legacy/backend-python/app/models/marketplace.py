"""models/marketplace.py — Voice Marketplace Pydantic models."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class VoiceMarketplaceEntry(BaseModel):
    id: str
    creator_name: str
    creator_bio: Optional[str] = None
    creator_avatar_url: Optional[str] = None
    voice_personality: str
    banned_concepts: list[str] = Field(default_factory=list)
    primary_hex: Optional[str] = None
    typography: list[str] = Field(default_factory=list)
    category: str  # 'founder' | 'creator' | 'executive' | 'indie_hacker'
    sample_posts: list[str] = Field(default_factory=list)
    fork_count: int = 0
    rating: float = 0.0
    rating_count: int = 0
    is_featured: bool = False
    created_at: Optional[datetime] = None


class VoiceCard(BaseModel):
    """Lightweight card shown in marketplace listing."""
    id: str
    creator_name: str
    creator_bio: Optional[str] = None
    creator_avatar_url: Optional[str] = None
    category: str
    voice_snippet: str  # first 200 chars of voice_personality
    fork_count: int = 0
    rating: float = 0.0


class ForkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customizations: Optional[dict[str, str]] = Field(default=None, max_length=8)


class ForkResponse(BaseModel):
    brand_dna: dict
    forked_from: str  # creator name
    success: bool
    message: str = ""


class MarketplaceListResponse(BaseModel):
    voices: list[VoiceCard]
    total_count: int
    page: int
    limit: int


class AngleTemplate(BaseModel):
    id: str
    category: str  # 'product_launch' | 'thought_leadership' | 'course' | 'general'
    angle_name: str
    hero_description: str
    proof_description: str
    cta_description: str
    example_proof_points: list[str] = Field(default_factory=list)


class WeeklyPrompt(BaseModel):
    id: str
    prompt_text: str
    scheduled_at: Optional[datetime] = None
    answered: bool = False
    answer_text: Optional[str] = None


class AnswerPromptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer_text: str = Field(min_length=1, max_length=2000)
    generate_campaign: bool = True


class UserPreferences(BaseModel):
    timezone: str = "UTC"
    weekly_prompts_enabled: bool = True
    prompt_send_time: str = "09:00"
    prompt_delivery_channels: list[str] = Field(default_factory=lambda: ["email", "in_app"])
    notifications_enabled: bool = True
