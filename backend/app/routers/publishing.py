"""
routers/publishing.py — Content publishing endpoints.

POST /v1/publish            — Publish to LinkedIn + X intent
POST /v1/publish/schedule   — Schedule future publish (stored in Supabase)
GET  /v1/publish/connected  — List connected accounts
POST /v1/publish/connect/:platform  — Connect OAuth account
DELETE /v1/publish/disconnect/:platform — Disconnect account
GET  /v1/auth/linkedin/callback     — LinkedIn OAuth2 callback
"""
from __future__ import annotations
import logging
import secrets
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.models.post import PublishRequest, PublishResponse
from app.services import publishing_service
from app.integrations.linkedin_client import (
    LinkedInClient,
    build_linkedin_auth_url,
    exchange_linkedin_code,
)
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/publish", tags=["publishing"])


def _user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


# ── Publishing ─────────────────────────────────────────────────────────────

@router.post("", response_model=PublishResponse)
async def publish_content(req: PublishRequest, request: Request):
    """
    Publish content to selected platforms.
    - LinkedIn: full API post
    - Twitter: returns Web Intent URL (user tweets manually)
    """
    user_id = _user_id(request)
    return await publishing_service.publish(user_id, req)


class ScheduleRequest(BaseModel):
    campaign_id: str
    content: dict[str, str]
    platforms: list[str]
    schedule_at: datetime


@router.post("/schedule", response_model=PublishResponse)
async def schedule_post(req: ScheduleRequest, request: Request):
    """Store a post for future publishing (APScheduler picks it up)."""
    user_id = _user_id(request)

    # Save as 'scheduled' status in Supabase
    from supabase import create_client
    s = get_settings()
    if not s.supabase_url:
        raise HTTPException(status_code=503, detail="Database not configured")
    sb = create_client(s.supabase_url, s.supabase_service_role_key)

    ids: dict[str, str] = {}
    for platform in req.platforms:
        draft = req.content.get(platform, "")
        if not draft:
            continue
        row = {
            "user_id": user_id,
            "campaign_id": req.campaign_id,
            "platform": platform,
            "content": draft,
            "scheduled_at": req.schedule_at.isoformat(),
            "published_at": req.schedule_at.isoformat(),  # will be updated on actual publish
            "status": "scheduled",
        }
        r = sb.table("published_posts").insert(row).execute()
        if r.data:
            ids[platform] = r.data[0]["id"]

    return PublishResponse(
        published_post_ids=ids,
        scheduled=True,
        success=True,
        message=f"Scheduled for {req.schedule_at.isoformat()}",
    )


# ── Connected accounts ─────────────────────────────────────────────────────

@router.get("/connected")
async def get_connected_accounts(request: Request):
    """Return which platforms are connected for this user."""
    user_id = _user_id(request)
    s = get_settings()
    if not s.supabase_url:
        return {"linkedin": {"connected": False}, "twitter": {"connected": False}}

    from supabase import create_client
    sb = create_client(s.supabase_url, s.supabase_service_role_key)
    result = (
        sb.table("connected_accounts")
        .select("platform, account_identifier")
        .eq("user_id", user_id)
        .execute()
    )
    connected = {row["platform"]: {"connected": True, "handle": row["account_identifier"]}
                 for row in (result.data or [])}

    return {
        "linkedin": connected.get("linkedin", {"connected": False}),
        "twitter": {"connected": False, "note": "Phase 1: Web Intent (no API needed)"},
    }


# ── LinkedIn OAuth flow ────────────────────────────────────────────────────

@router.get("/connect/linkedin")
async def connect_linkedin_start(request: Request):
    """Redirect user to LinkedIn OAuth consent page."""
    _user_id(request)
    state = secrets.token_urlsafe(16)
    auth_url = build_linkedin_auth_url(state)
    return {"auth_url": auth_url, "state": state}


# This route must be in _PUBLIC_PATHS in main.py
linkedin_callback_router = APIRouter(tags=["auth"])


@linkedin_callback_router.get("/auth/linkedin/callback")
async def linkedin_callback(code: str, state: str, request: Request):
    """
    LinkedIn OAuth callback.
    Exchanges code for access_token, saves (encrypted) to connected_accounts.
    Redirects to /dashboard/settings/auth on success.
    """
    s = get_settings()
    try:
        token_data = await exchange_linkedin_code(code)
        access_token = token_data.get("access_token", "")
        expires_in = token_data.get("expires_in", 5184000)  # 60 days default

        client = LinkedInClient(access_token)
        profile = await client.get_profile()
        account_id = profile.get("id", "")
        display_name = f"{profile.get('localizedFirstName', '')} {profile.get('localizedLastName', '')}".strip()

        # We need user_id from state/session — for now read from query param (dev)
        # In production, encode user_id in state token
        user_id = request.query_params.get("user_id", "")
        if not user_id or not s.supabase_url:
            raise ValueError("Cannot determine user_id from callback")

        from supabase import create_client
        from app.services.publishing_service import encrypt_token
        sb = create_client(s.supabase_url, s.supabase_service_role_key)
        sb.table("connected_accounts").upsert({
            "user_id": user_id,
            "platform": "linkedin",
            "access_token": encrypt_token(access_token),
            "platform_user_id": account_id,
            "account_identifier": display_name,
        }).execute()

        return RedirectResponse(
            url=f"{s.frontend_url}/dashboard/settings/auth?connected=linkedin"
        )
    except Exception as exc:
        logger.error("LinkedIn callback error: %s", exc)
        return RedirectResponse(
            url=f"{s.frontend_url}/dashboard/settings/auth?error=linkedin_failed"
        )


@router.delete("/disconnect/{platform}")
async def disconnect_account(platform: str, request: Request):
    """Remove connected account for a platform."""
    user_id = _user_id(request)
    s = get_settings()
    if not s.supabase_url:
        raise HTTPException(status_code=503, detail="DB not configured")
    from supabase import create_client
    sb = create_client(s.supabase_url, s.supabase_service_role_key)
    sb.table("connected_accounts").delete().eq("user_id", user_id).eq("platform", platform).execute()
    return {"platform": platform, "disconnected": True, "success": True}
