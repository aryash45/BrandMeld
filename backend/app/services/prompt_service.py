"""
services/prompt_service.py — Weekly Prompt Engine.

Weekly prompts are generated on demand or seeded from prompt_templates.
Sending is done via APScheduler (dev) or Cloud Scheduler (prod).

Scheduler note:
  Cloud Run scales to zero, so APScheduler is unreliable for the Sunday 9 AM job.
  For production: deploy a Cloud Scheduler cron → Cloud Run Job that calls
  POST /v1/internal/prompts/send-batch (protected by INTERNAL_KEY header).
"""
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.config import get_settings
from app.models.marketplace import WeeklyPrompt, UserPreferences

logger = logging.getLogger(__name__)

# 4-week rotating prompt bank (supplements DB templates)
_DEFAULT_PROMPTS = [
    "What's one thing that changed in your product this week that surprised you?",
    "What's a belief you held 6 months ago that you no longer believe?",
    "What's the hardest decision you made this week, and why?",
    "What would you tell your younger self before they started this company?",
    "What's one thing your customers keep getting wrong about your product?",
    "What's a lesson from a non-tech domain you've applied to your work?",
    "What's the most counter-intuitive thing about building in your space?",
    "Describe a moment this week where things didn't go to plan. What did you learn?",
]


def _get_sb():
    from supabase import create_client
    s = get_settings()
    if not s.supabase_url:
        return None
    return create_client(s.supabase_url, s.supabase_service_role_key)


async def get_current_prompt(user_id: str) -> Optional[WeeklyPrompt]:
    """
    Get the most recent unanswered prompt for this user.
    If none exists, generate a new one.
    """
    sb = _get_sb()
    if not sb:
        # Dev fallback: return a static prompt
        return WeeklyPrompt(
            id=str(uuid.uuid4()),
            prompt_text=_DEFAULT_PROMPTS[0],
            answered=False,
        )

    r = (
        sb.table("weekly_prompts")
        .select("*")
        .eq("user_id", user_id)
        .eq("answered", False)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if r.data:
        d = r.data[0]
        return WeeklyPrompt(
            id=d["id"],
            prompt_text=d.get("custom_prompt_text") or _DEFAULT_PROMPTS[0],
            scheduled_at=d.get("scheduled_at"),
            answered=d.get("answered", False),
            answer_text=d.get("answer_text"),
        )

    # No prompt found — create one
    return await _create_prompt_for_user(user_id, sb)


async def _create_prompt_for_user(user_id: str, sb) -> WeeklyPrompt:
    """Generate and insert the next prompt for a user."""
    # Count past prompts to determine rotation
    count_r = (
        sb.table("weekly_prompts")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    week_num = (count_r.count or 0) % len(_DEFAULT_PROMPTS)
    prompt_text = _DEFAULT_PROMPTS[week_num]

    row = {
        "user_id": user_id,
        "custom_prompt_text": prompt_text,
        "answered": False,
    }
    insert_r = sb.table("weekly_prompts").insert(row).execute()
    if insert_r.data:
        d = insert_r.data[0]
        return WeeklyPrompt(id=d["id"], prompt_text=prompt_text, answered=False)

    return WeeklyPrompt(id=str(uuid.uuid4()), prompt_text=prompt_text, answered=False)


async def answer_prompt(
    user_id: str,
    prompt_id: str,
    answer_text: str,
) -> bool:
    """Mark prompt as answered with the user's response text."""
    sb = _get_sb()
    if not sb:
        return True  # dev: silently succeed

    sb.table("weekly_prompts").update({
        "answered": True,
        "answer_text": answer_text,
    }).eq("id", prompt_id).eq("user_id", user_id).execute()
    return True


async def get_prompt_history(user_id: str, limit: int = 10) -> list[dict]:
    """List past prompts for this user."""
    sb = _get_sb()
    if not sb:
        return []
    r = (
        sb.table("weekly_prompts")
        .select("id, custom_prompt_text, answered, answer_text, created_at, created_campaign_id")
        .eq("user_id", user_id)
        .eq("answered", True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return r.data or []


async def get_user_preferences(user_id: str) -> UserPreferences:
    """Get user prompt preferences, or return defaults."""
    sb = _get_sb()
    if not sb:
        return UserPreferences()
    r = sb.table("user_preferences").select("*").eq("user_id", user_id).maybe_single().execute()
    if r.data:
        d = r.data
        return UserPreferences(
            timezone=d.get("timezone", "UTC"),
            weekly_prompts_enabled=d.get("weekly_prompts_enabled", True),
            prompt_send_time=d.get("prompt_send_time", "09:00"),
            prompt_delivery_channels=d.get("prompt_delivery_channels", ["email", "in_app"]),
            notifications_enabled=d.get("notifications_enabled", True),
        )
    return UserPreferences()


async def save_user_preferences(user_id: str, prefs: UserPreferences) -> bool:
    """Upsert user preferences."""
    sb = _get_sb()
    if not sb:
        return False
    sb.table("user_preferences").upsert({
        "user_id": user_id,
        **prefs.model_dump(),
    }).execute()
    return True
