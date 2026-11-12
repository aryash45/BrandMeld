"""
shared/db.py — Unified Supabase client factory.

OWASP fix applied
-----------------
P2-4: Removed the anon key fallback. The backend always operates with the
      service role key so it can bypass Row Level Security (RLS) for
      server-side queries. The anon key is intended for client-side use only.

      Previously, if SUPABASE_SERVICE_ROLE_KEY was unset, the backend would
      silently use the anon key — which is subject to RLS and would produce
      unpredictable/inconsistent data access behavior.

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
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_supabase_client():
    """
    Return a Supabase client (with service role key) or None if env vars are missing.

    P2-4: Only uses SUPABASE_SERVICE_ROLE_KEY — no anon key fallback.
    Returns None (instead of raising) so callers can gracefully handle
    the "database not available in dev mode" case.
    """
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not url or not key:
        logger.debug("Supabase env vars not set — returning None client")
        return None

    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        logger.error("Failed to create Supabase client: %s", exc)
        return None
