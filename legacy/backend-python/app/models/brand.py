"""models/brand.py — BrandDNA and VoiceProfile Pydantic models."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class BrandDNA(BaseModel):
    brand_name: str
    primary_hex: str = "#FFFFFF"
    typography: list[str] = Field(default_factory=list)
    voice_personality: str
    banned_concepts: list[str] = Field(default_factory=list)
    source_url: Optional[str] = None
    forked_from_voice_id: Optional[str] = None  # marketplace voice id


class VoiceTweak(BaseModel):
    """Inline voice adjustment sliders sent from frontend."""
    casualness: int = Field(default=50, ge=0, le=100,
                            description="0=very professional, 100=very casual")
    jargon_level: int = Field(default=50, ge=0, le=100,
                              description="0=plain english, 100=heavy jargon")
    opinionated: int = Field(default=50, ge=0, le=100,
                             description="0=balanced, 100=strong opinions")


class AuthenticityScore(BaseModel):
    tone_match: int = Field(ge=0, le=100)
    vocabulary_match: int = Field(ge=0, le=100)
    structure_match: int = Field(ge=0, le=100)
    authenticity: int = Field(ge=0, le=100)
    overall: int = Field(ge=0, le=100)
    confidence_band: int = 5
    hints: list[str] = Field(default_factory=list)
