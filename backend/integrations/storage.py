"""
integrations/storage.py — Supabase persistence for agent data.

Stores and retrieves VoiceProfiles. Gracefully returns None / no-ops when
Supabase is not configured (so the agent works offline for testing).

Usage:
    from integrations.storage import save_voice_profile, load_voice_profile

    # Save (no-op if Supabase unconfigured)
    await save_voice_profile(user_id="abc123", profile=voice_profile)

    # Load (returns None if not found or DB unavailable)
    profile = await load_voice_profile(user_id="abc123")
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

logger = logging.getLogger(__name__)

TABLE_VOICE_PROFILES = "voice_profiles"


def _get_db():
    """Lazy import to avoid requiring Supabase env vars at import time."""
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
    from app.shared.db import get_supabase_client
    return get_supabase_client()


async def save_voice_profile(user_id: str, profile: "VoiceProfile") -> bool:  # noqa: F821
    """
    Upsert a VoiceProfile to Supabase.

    Returns:
        True if saved, False if Supabase unavailable (silent no-op).
    """
    db = _get_db()
    if db is None:
        logger.debug("Supabase not configured — voice profile not saved.")
        return False

    data = {
        "user_id": user_id,
        "profile": profile.model_dump(),
    }

    def _upsert():
        return (
            db.table(TABLE_VOICE_PROFILES)
            .upsert(data, on_conflict="user_id")
            .execute()
        )

    try:
        await asyncio.to_thread(_upsert)
        logger.info("Voice profile saved for user %s", user_id)
        return True
    except Exception as exc:
        logger.error("Failed to save voice profile: %s", exc)
        return False


async def load_voice_profile(user_id: str) -> "VoiceProfile | None":  # noqa: F821
    """
    Load a VoiceProfile from Supabase.

    Returns:
        VoiceProfile if found, None otherwise.
    """
    db = _get_db()
    if db is None:
        logger.debug("Supabase not configured — cannot load voice profile.")
        return None

    def _fetch():
        return (
            db.table(TABLE_VOICE_PROFILES)
            .select("profile")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

    try:
        result = await asyncio.to_thread(_fetch)
        if result.data and result.data.get("profile"):
            backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if backend_root not in sys.path:
                sys.path.insert(0, backend_root)
            from agent.models import VoiceProfile
            return VoiceProfile(**result.data["profile"])
        return None
    except Exception as exc:
        logger.warning("Failed to load voice profile for %s: %s", user_id, exc)
        return None
