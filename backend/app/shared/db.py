"""
shared/db.py — Unified Supabase client factory.

Replaces the 5+ duplicate `_get_sb()` / `_get_supabase()` helpers that
previously lived in each service/router file.

Usage
-----
    from app.shared.db import get_supabase_client

    db = get_supabase_client()
    if db is None:
        raise HTTPException(503, "Database not configured")
    result = db.table("my_table").select("*").execute()
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def get_supabase_client():
    """
    Return a Supabase client or None if env vars are missing.

    Prefers SUPABASE_SERVICE_ROLE_KEY; falls back to SUPABASE_ANON_KEY.
    Returns None (instead of raising) so callers can handle the
    "database not available in dev mode" case gracefully.
    """
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )

    if not url or not key:
        logger.debug("Supabase env vars not set — returning None client")
        return None

    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        logger.error("Failed to create Supabase client: %s", exc)
        return None
