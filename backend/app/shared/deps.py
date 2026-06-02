"""
shared/deps.py — Shared FastAPI dependencies.

Replaces the 5 identical `_user_id(request)` helper functions that were
copy-pasted into every router file.

Usage
-----
    from app.shared.deps import get_user_id

    @router.get("/my-route")
    async def my_route(user_id: str = Depends(get_user_id)):
        ...

    # Or for direct access without Depends:
    user_id = get_user_id_from_request(request)
"""
from __future__ import annotations

from fastapi import Request


def get_user_id_from_request(request: Request) -> str:
    """
    Extract the user_id attached by the JWT auth middleware.
    Falls back to "anonymous" if not set (dev mode or public routes).
    """
    return getattr(request.state, "user_id", "anonymous")


def get_user_id(request: Request) -> str:
    """
    FastAPI dependency — inject as `user_id: str = Depends(get_user_id)`.

    The JWT auth middleware populates request.state.user_id from the
    validated Bearer token. If auth is disabled (dev mode), returns "dev-user".
    """
    return get_user_id_from_request(request)
