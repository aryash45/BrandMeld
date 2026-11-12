"""models/campaign.py — Campaign request/response Pydantic models."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

VALID_PLATFORMS = {"twitter", "linkedin", "instagram", "newsletter"}


class CampaignBrief(BaseModel):
    what_changed: str = Field(min_length=1, max_length=2000)
    why_it_matters: str = Field(default="", max_length=2000)
    target_audience: str = Field(default="", max_length=1000)
    proof_points: list[str] = Field(default_factory=list, max_length=8)
    call_to_action: str = Field(default="", max_length=500)


class CampaignAngle(BaseModel):
    title: str
    audience_focus: str
    core_message: str
    proof_to_use: list[str] = Field(default_factory=list)
    call_to_action: str
    why_this_works: str


class CampaignChannelPlan(BaseModel):
    platform: str
    format: str
    rationale: str


class CampaignPlan(BaseModel):
    campaign_headline: str
    summary: str
    primary_angle: CampaignAngle
    alternate_angles: list[str] = Field(default_factory=list)
    channels: list[CampaignChannelPlan] = Field(default_factory=list)
    recommended_prompt: str
    approval_checklist: list[str] = Field(default_factory=list)


class CampaignPlanRequest(BaseModel):
    brief: CampaignBrief
    brand_voice: Optional[str] = Field(default=None, max_length=5000)
    brand_dna: Optional[dict] = None
    platforms: list[str] = Field(
        default_factory=lambda: ["twitter", "linkedin", "newsletter"],
        min_length=1,
    )


class CampaignPlanResponse(BaseModel):
    plan: CampaignPlan
    success: bool
    message: str = ""


class CampaignLaunchRequest(BaseModel):
    content_request: str = Field(min_length=1, max_length=4000)
    brand_voice: Optional[str] = Field(default=None, max_length=5000)
    brand_dna: Optional[dict] = None
    platforms: list[str] = Field(
        default_factory=lambda: ["twitter", "linkedin", "newsletter"],
        min_length=1,
    )


class CampaignLaunchResponse(BaseModel):
    results: dict[str, str]
    authenticity_scores: dict[str, int] = Field(default_factory=dict)
    campaign_id: Optional[str] = None
    success: bool
    message: str = ""


class EditRequest(BaseModel):
    original_content: str = Field(min_length=1, max_length=12000)
    brand_voice: str = Field(min_length=1, max_length=5000)
    edit_command: str = Field(min_length=1, max_length=32)


class EditResponse(BaseModel):
    edited_content: str
    success: bool
    message: str = ""


class OnboardRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    user_id: Optional[str] = Field(default=None, max_length=128)


class OnboardResponse(BaseModel):
    brand_dna: dict
    stored: bool
    message: str = ""
