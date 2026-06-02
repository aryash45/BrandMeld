"""
services/marketplace_service.py — Voice Marketplace logic.

Handles:
  - Listing and filtering voices
  - Fetching voice detail + sample posts
  - Forking a voice into user's brand_dna
  - Rating a voice
"""
from __future__ import annotations
import logging
from typing import Optional

from app.config import get_settings
from app.models.marketplace import (
    VoiceMarketplaceEntry,
    VoiceCard,
    MarketplaceListResponse,
    ForkResponse,
    AngleTemplate,
)
from app.shared.db import get_supabase_client

logger = logging.getLogger(__name__)

# ── Angle Templates (static seed, no DB needed for Phase 1) ───────────────
ANGLE_TEMPLATES: list[AngleTemplate] = [
    AngleTemplate(id="at-01", category="product_launch", angle_name="The Origin Story",
                  hero_description="Share the human problem that sparked the idea",
                  proof_description="Show an early version or first customer reaction",
                  cta_description="Invite readers to be part of the journey",
                  example_proof_points=["3 months of rejections before first yes", "Solved my own problem first"]),
    AngleTemplate(id="at-02", category="product_launch", angle_name="The Number Drop",
                  hero_description="Lead with a specific, surprising metric",
                  proof_description="Context that makes the number meaningful",
                  cta_description="Explain what's next based on the result",
                  example_proof_points=["0 → $10K MRR in 90 days", "1,000 waitlist in 48 hours"]),
    AngleTemplate(id="at-03", category="thought_leadership", angle_name="The Contrarian Take",
                  hero_description="Challenge a widely-held belief in your space",
                  proof_description="Evidence or reasoning others are missing",
                  cta_description="Ask the audience if they agree or disagree",
                  example_proof_points=["Most founders are doing X wrong", "The real reason Y fails"]),
    AngleTemplate(id="at-04", category="thought_leadership", angle_name="The Framework Drop",
                  hero_description="Name and frame your mental model",
                  proof_description="Apply the framework to a real-world example",
                  cta_description="Invite others to apply it and share results",
                  example_proof_points=["The 3-layer trust framework", "My flywheel for content ideas"]),
    AngleTemplate(id="at-05", category="course", angle_name="The Lesson Learned",
                  hero_description="What you wish you knew before starting",
                  proof_description="The specific mistake and its cost",
                  cta_description="Offer the shortcut to avoid the mistake",
                  example_proof_points=["Wasted 6 months before finding this", "The $50K mistake"]),
    AngleTemplate(id="at-06", category="course", angle_name="The Student Win",
                  hero_description="Celebrate a student's result in their words",
                  proof_description="What they did specifically with your material",
                  cta_description="Invite similar students to join",
                  example_proof_points=["She closed 3 clients in 2 weeks", "He quit his job 30 days after enrolling"]),
    AngleTemplate(id="at-07", category="general", angle_name="Behind the Scenes",
                  hero_description="Pull back the curtain on something usually hidden",
                  proof_description="The messy reality vs. the polished exterior",
                  cta_description="Normalise the struggle for the audience",
                  example_proof_points=["What my actual Monday looks like", "The 20 drafts before this post"]),
    AngleTemplate(id="at-08", category="general", angle_name="The Hot Take",
                  hero_description="State a polarizing opinion in the first sentence",
                  proof_description="3 reasons why you believe this",
                  cta_description="Dare them to disagree",
                  example_proof_points=["Cold DMs are not dead", "Most productivity advice is wrong"]),
    AngleTemplate(id="at-09", category="product_launch", angle_name="The Waitlist Reveal",
                  hero_description="Announce the product and the problem it solves",
                  proof_description="Show social proof from beta testers",
                  cta_description="Drive signups with urgency",
                  example_proof_points=["150 beta users. Average time saved: 4h/week", "Closed beta → open waitlist"]),
    AngleTemplate(id="at-10", category="thought_leadership", angle_name="The Prediction",
                  hero_description="Make a specific, time-bound prediction",
                  proof_description="Trends or signals that point to it",
                  cta_description="Ask who agrees and invite follow for the update",
                  example_proof_points=["AI will kill cold email by 2026", "Solo founders will outperform teams by 2027"]),
]



async def list_voices(
    category: Optional[str] = None,
    sort: str = "trending",
    page: int = 1,
    limit: int = 12,
) -> MarketplaceListResponse:
    """List marketplace voices with optional filtering."""
    sb = get_supabase_client()
    if not sb:
        return MarketplaceListResponse(voices=[], total_count=0, page=page, limit=limit)

    q = sb.table("voice_marketplace_entries").select(
        "id, creator_name, creator_bio, creator_avatar_url, category, voice_personality, fork_count, rating",
        count="exact",
    )
    if category:
        q = q.eq("category", category)
    if sort == "trending":
        q = q.order("fork_count", desc=True)
    elif sort == "top_rated":
        q = q.order("rating", desc=True)
    else:
        q = q.order("created_at", desc=True)

    offset = (page - 1) * limit
    q = q.range(offset, offset + limit - 1)
    result = q.execute()

    voices = [
        VoiceCard(
            id=v["id"],
            creator_name=v["creator_name"],
            creator_bio=v.get("creator_bio"),
            creator_avatar_url=v.get("creator_avatar_url"),
            category=v["category"],
            voice_snippet=(v.get("voice_personality") or "")[:200],
            fork_count=v.get("fork_count", 0),
            rating=v.get("rating", 0.0),
        )
        for v in (result.data or [])
    ]

    return MarketplaceListResponse(
        voices=voices,
        total_count=result.count or 0,
        page=page,
        limit=limit,
    )


async def get_voice(voice_id: str) -> Optional[dict]:
    """Get full voice detail."""
    sb = get_supabase_client()
    if not sb:
        return None
    r = sb.table("voice_marketplace_entries").select("*").eq("id", voice_id).maybe_single().execute()
    return r.data


async def fork_voice(user_id: str, voice_id: str, customizations: Optional[dict] = None) -> ForkResponse:
    """
    Fork a marketplace voice into the user's brand_dna.
    Merges any customizations, increments fork_count.
    """
    sb = get_supabase_client()
    if not sb:
        return ForkResponse(brand_dna={}, forked_from="", success=False, message="DB not configured")

    voice = await get_voice(voice_id)
    if not voice:
        return ForkResponse(brand_dna={}, forked_from="", success=False, message="Voice not found")

    dna = {
        "brand_name": voice.get("creator_name", ""),
        "primary_hex": voice.get("primary_hex", "#EAFF00"),
        "typography": voice.get("typography", []),
        "voice_personality": voice.get("voice_personality", ""),
        "banned_concepts": voice.get("banned_concepts", []),
        "forked_from_voice_id": voice_id,
    }
    if customizations:
        dna.update({k: v for k, v in customizations.items() if k in dna})

    # Upsert into brand_dna
    sb.table("brand_dna").upsert({
        "user_id": user_id,
        **dna,
    }).execute()

    # Record fork
    sb.table("voice_marketplace_forks").insert({
        "user_id": user_id,
        "voice_entry_id": voice_id,
        "customizations": customizations or {},
    }).execute()

    # Increment fork_count
    sb.rpc("increment_fork_count", {"voice_id": voice_id}).execute()

    return ForkResponse(
        brand_dna=dna,
        forked_from=voice.get("creator_name", ""),
        success=True,
    )


def get_angle_templates(category: Optional[str] = None) -> list[AngleTemplate]:
    """Return angle templates, optionally filtered by category."""
    if category:
        return [t for t in ANGLE_TEMPLATES if t.category == category]
    return ANGLE_TEMPLATES
