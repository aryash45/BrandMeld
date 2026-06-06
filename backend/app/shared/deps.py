"""
shared/deps.py — Shared FastAPI dependencies.

OWASP fix applied
-----------------
P2-3: get_user_id now raises 401 instead of silently returning "anonymous".
      If the JWT middleware fails to attach user_id for any reason, all
      downstream DB queries would have silently run under "anonymous" — a
      shared ghost identity that could let users read each other's data.
"""
from __future__ import annotations

from fastapi import HTTPException, Request


def get_user_id_from_request(request: Request) -> str:
    """
    Extract the user_id attached by the JWT auth middleware.

    P2-3: Raises HTTP 401 instead of falling back to "anonymous" if user_id
    is missing. A missing user_id indicates the auth middleware didn't run
    (misconfiguration) or the token was invalid — both should be treated
    as unauthenticated, not passed through as a shared ghost identity.
    """
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return uid


def get_user_id(request: Request) -> str:
    """
    Primary auth dependency — call directly or inject via Depends(get_user_id).

    The JWT auth middleware populates request.state.user_id from the
    validated Bearer token before any route handler runs.

    Raises HTTP 401 if user_id is absent (P2-3).
    """
    return get_user_id_from_request(request)
