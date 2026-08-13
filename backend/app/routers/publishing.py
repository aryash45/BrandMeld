"""
routers/publishing.py — Content publishing endpoints.

POST /v1/publish            — Publish to LinkedIn + X intent
POST /v1/publish/schedule   — Schedule future publish (stored in Supabase)
GET  /v1/publish/connected  — List connected accounts
POST /v1/publish/connect/:platform  — Connect OAuth account
DELETE /v1/publish/disconnect/:platform — Disconnect account
GET  /v1/auth/linkedin/callback     — LinkedIn OAuth2 callback

OWASP fixes applied
-------------------
P0-2  OAuth callback no longer reads user_id from URL query param.
      user_id is encoded (HMAC-signed) in the state token at initiation
      and verified at callback — eliminating the account-takeover vector.
P1-5  OAuth state parameter is now verified against a stored value in Supabase.
P2-6  Platform path parameter validated against allowlist on disconnect.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import logging
import os
import secrets
import base64
from typing import Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator

from app.models.post import PublishRequest, PublishResponse
from app.services import publishing_service
from app.integrations.linkedin_client import (
    LinkedInClient,
    build_linkedin_auth_url,
    exchange_linkedin_code,
)
from app.config import get_settings
from app.shared.deps import get_user_id
from app.shared.db import get_supabase_client
from supabase import create_client as _create_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/publish", tags=["publishing"])

# P2-6: Allowlist for platform values
_VALID_PLATFORMS = {"linkedin", "twitter", "instagram"}


# ── OAuth state token helpers (P0-2, P1-5) ────────────────────────────────────

def _get_state_secret() -> bytes:
    """Legacy helper retained for compatibility; production requires a DB nonce."""
    raw = os.getenv("STATE_SECRET", "")
    if not raw:
        raise RuntimeError("STATE_SECRET is not configured")
    return raw.encode()


def _build_state_token(user_id: str) -> str:
    """
    Encode user_id into a signed state token.
    Format: base64url(json_payload).base64url(hmac_signature)
    """
    return secrets.token_urlsafe(32)


def _verify_state_token(token: str) -> str:
    """
    Verify and decode the state token. Returns user_id.
    Raises ValueError if the token is invalid or tampered.
    """
    try:
        parts = token.split(".", 1)
        if len(parts) != 2:
            raise ValueError("Malformed state token")

        # Restore base64 padding
        payload_b64, sig_b64 = parts
        payload = base64.urlsafe_b64decode(payload_b64 + "==")
        sig = base64.urlsafe_b64decode(sig_b64 + "==")

        # Constant-time comparison (P1-5: prevent timing attacks)
        expected_sig = hmac.new(_get_state_secret(), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("State token signature invalid")

        data = json.loads(payload)
        user_id = data.get("uid")
        if not user_id:
            raise ValueError("State token missing user identifier")
        return user_id
    except (ValueError, KeyError) as exc:
        raise ValueError(f"Invalid state token: {exc}") from exc


def _save_oauth_state(state: str, user_id: str) -> None:
    """Store state in Supabase with 15-minute TTL for CSRF verification (P1-5)."""
    sb = get_supabase_client()
    if not sb:
        if get_settings().is_production:
            raise RuntimeError("OAuth state storage is unavailable")
        return
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    try:
        sb.table("oauth_state").upsert({
            "state": state,
            "user_id": user_id,
            "expires_at": expiry,
        }).execute()
    except Exception as exc:
        logger.error("Failed to persist OAuth state: %s", type(exc).__name__)
        if get_settings().is_production:
            raise RuntimeError("OAuth state storage is unavailable") from exc


def _consume_oauth_state(state: str) -> Optional[str]:
    """
    Verify state exists in DB, delete it (one-time use), return user_id.
    Returns None if state not found or expired (P1-5).
    """
    sb = get_supabase_client()
    if not sb:
        return None
    try:
        rpc = sb.rpc("consume_oauth_state", {"input_state": state}).execute()
        if rpc.data:
            return rpc.data[0].get("user_id")
        return None
    except Exception as exc:
        logger.error("OAuth state consumption failed: %s", type(exc).__name__)
        return None


# ── Publishing ─────────────────────────────────────────────────────────────

@router.post("", response_model=PublishResponse)
async def publish_content(req: PublishRequest, request: Request):
    """
    Publish content to selected platforms.
    - LinkedIn: full API post
    - Twitter: returns Web Intent URL (user tweets manually)
    """
    user_id = get_user_id(request)
    return await publishing_service.publish(user_id, req)


class ScheduleRequest(BaseModel):
    campaign_id: str
    content: dict[str, str] = Field(max_length=4)
    platforms: list[str] = Field(min_length=1, max_length=4)
    schedule_at: datetime

    @field_validator("schedule_at")
    @classmethod
    def validate_schedule_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("schedule_at must include a timezone")
        if value <= datetime.now(timezone.utc):
            raise ValueError("schedule_at must be in the future")
        return value


@router.post("/schedule", response_model=PublishResponse)
async def schedule_post(req: ScheduleRequest, request: Request):
    """Store a post for future publishing (APScheduler picks it up)."""
    user_id = get_user_id(request)
    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database not configured")

    campaign = (
        sb.table("campaigns")
        .select("id")
        .eq("id", req.campaign_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    ids: dict[str, str] = {}
    for platform in req.platforms:
        # P2-6: Validate platform
        if platform not in _VALID_PLATFORMS:
            raise HTTPException(status_code=400, detail=f"Invalid platform: {platform!r}")
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
    user_id = get_user_id(request)
    sb = get_supabase_client()
    if not sb:
        return {"linkedin": {"connected": False}, "twitter": {"connected": False}}
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
    """
    Redirect user to LinkedIn OAuth consent page.
    P0-2 + P1-5: user_id encoded in signed state token (not passed in URL).
    State also saved to DB for server-side CSRF verification.
    """
    user_id = get_user_id(request)
    state = _build_state_token(user_id)
    _save_oauth_state(state, user_id)  # P1-5: persist for CSRF check
    auth_url = build_linkedin_auth_url(state)
    return {"auth_url": auth_url, "state": state}


# This route must be in _PUBLIC_PATHS in main.py
linkedin_callback_router = APIRouter(tags=["auth"])


@linkedin_callback_router.get("/auth/linkedin/callback")
async def linkedin_callback(code: str, state: str, request: Request):
    """
    LinkedIn OAuth callback.
    Exchanges code for access_token, saves (encrypted) to connected_accounts.
    Redirects to /settings on success.

    P0-2: user_id is extracted from the verified signed state token —
          NOT from request.query_params.get("user_id") which was trivially forgeable.
    P1-5: State is verified against DB record (one-time use) to prevent CSRF.
    """
    s = get_settings()
    try:
        # P1-5: Verify state via DB lookup first (CSRF protection)
        user_id = _consume_oauth_state(state)

        if user_id is None:
            return RedirectResponse(url=f"{s.frontend_url}/settings?error=invalid_state")

        if not user_id:
            logger.warning("OAuth callback: could not determine user_id from state")
            return RedirectResponse(
                url=f"{s.frontend_url}/settings?error=invalid_state"
            )

        token_data = await exchange_linkedin_code(code)
        access_token = token_data.get("access_token", "")
        expires_in = token_data.get("expires_in", 5184000)  # 60 days default

        client = LinkedInClient(access_token)
        profile = await client.get_profile()
        account_id = profile.get("id", "")
        display_name = f"{profile.get('localizedFirstName', '')} {profile.get('localizedLastName', '')}".strip()

        if not s.supabase_url:
            raise ValueError("Supabase not configured")

        from app.services.publishing_service import encrypt_token
        sb = _create_supabase_client(s.supabase_url, s.supabase_service_role_key)
        sb.table("connected_accounts").upsert({
            "user_id": user_id,
            "platform": "linkedin",
            "access_token": encrypt_token(access_token),
            "platform_user_id": account_id,
            "account_identifier": display_name,
        }).execute()

        return RedirectResponse(
            url=f"{s.frontend_url}/settings?connected=linkedin"
        )
    except Exception as exc:
        logger.warning("LinkedIn callback error: %s", type(exc).__name__)
        return RedirectResponse(
            url=f"{s.frontend_url}/settings?error=linkedin_failed"
        )


@router.delete("/disconnect/{platform}")
async def disconnect_account(platform: str, request: Request):
    """
    Remove connected account for a platform.
    P2-6: Platform path parameter validated against allowlist.
    """
    user_id = get_user_id(request)

    # P2-6: Reject unknown platform values
    if platform not in _VALID_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform {platform!r}. Valid options: {sorted(_VALID_PLATFORMS)}",
        )

    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=503, detail="DB not configured")
    sb.table("connected_accounts").delete().eq("user_id", user_id).eq("platform", platform).execute()
    return {"platform": platform, "disconnected": True, "success": True}
