"""
services/publishing_service.py — Multi-platform content publishing.

Phase 1 support:
  - LinkedIn: full API posting via ugcPosts
  - X (Twitter): Web Intent URL (no API key needed)
  - Email (Newsletter): stub — ready for Beehiiv/Mailgun integration

All tokens are retrieved from Supabase connected_accounts table.
Tokens are stored encrypted (Fernet) and decrypted here at runtime.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from app.config import get_settings
from app.integrations.linkedin_client import LinkedInClient
from app.integrations.twitter_client import build_tweet_intent_url, split_into_thread
from app.models.post import PublishRequest, PublishResponse
from app.shared.db import get_supabase_client

logger = logging.getLogger(__name__)


# ── Token encryption helpers ───────────────────────────────────────────────

def _fernet():
    """Lazily init Fernet cipher. Returns None if key not configured."""
    from app.config import get_settings
    key = get_settings().encryption_key
    if not key:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        logger.error("Fernet init failed: %s", e)
        return None


def encrypt_token(plain: str) -> str:
    """Encrypt OAuth token before storing in DB. Returns plain if key unset."""
    f = _fernet()
    if not f:
        return plain
    return f.encrypt(plain.encode()).decode()


def decrypt_token(cipher: str) -> str:
    """Decrypt OAuth token from DB. Returns as-is if key unset."""
    f = _fernet()
    if not f:
        return cipher
    try:
        return f.decrypt(cipher.encode()).decode()
    except Exception:
        logger.warning("Token decryption failed — returning raw value")
        return cipher


# ── Supabase helpers ───────────────────────────────────────────────────────

async def _get_connected_account(user_id: str, platform: str) -> Optional[dict]:
    """Fetch and decrypt connected account for a user+platform."""
    sb = get_supabase_client()
    if not sb:
        return None
    result = (
        sb.table("connected_accounts")
        .select("*")
        .eq("user_id", user_id)
        .eq("platform", platform)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None
    row = dict(result.data)
    if row.get("access_token"):
        row["access_token"] = decrypt_token(row["access_token"])
    return row


async def _save_published_post(
    user_id: str,
    campaign_id: Optional[str],
    platform: str,
    content: str,
    platform_post_id: Optional[str] = None,
    status: str = "published",
    error_message: Optional[str] = None,
) -> Optional[str]:
    """Insert row into published_posts, return new row id."""
    from supabase import create_client
    settings = get_settings()
    if not settings.supabase_url:
        return None
    sb = create_client(settings.supabase_url, settings.supabase_service_role_key)
    row = {
        "user_id": user_id,
        "campaign_id": campaign_id,
        "platform": platform,
        "content": content,
        "platform_post_id": platform_post_id,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "error_message": error_message,
    }
    r = sb.table("published_posts").insert(row).execute()
    if r.data:
        return r.data[0].get("id")
    return None


# ── Publishing logic ───────────────────────────────────────────────────────

async def publish_to_linkedin(
    user_id: str, campaign_id: Optional[str], draft: str
) -> tuple[Optional[str], Optional[str]]:
    """
    Post to LinkedIn.
    Returns (post_id, error_message).
    """
    account = await _get_connected_account(user_id, "linkedin")
    if not account:
        return None, "LinkedIn account not connected"

    try:
        client = LinkedInClient(account["access_token"])
        profile = await client.get_profile()
        author_urn = f"urn:li:person:{profile['id']}"
        result = await client.create_post(draft, author_urn)
        post_id = result.get("id")
        db_id = await _save_published_post(
            user_id, campaign_id, "linkedin", draft, post_id, "published"
        )
        return db_id, None
    except Exception as exc:
        logger.error("LinkedIn publish failed for user %s: %s", user_id, exc)
        db_id = await _save_published_post(
            user_id, campaign_id, "linkedin", draft, None, "failed", str(exc)
        )
        return db_id, str(exc)


def get_twitter_intent(draft: str) -> str:
    """
    Phase 1: Return a twitter.com/intent/tweet URL.
    User clicks → X composer opens pre-filled → user tweets manually.
    """
    return build_tweet_intent_url(draft)


async def publish(
    user_id: str,
    req: PublishRequest,
) -> PublishResponse:
    """
    Orchestrate publishing across requested platforms.
    Returns a unified PublishResponse with per-platform results.
    """
    published_ids: dict[str, str] = {}
    errors: dict[str, str] = {}
    twitter_intent_url: Optional[str] = None

    for platform in req.platforms:
        draft = req.content.get(platform, "")
        if not draft:
            errors[platform] = "No draft content for this platform"
            continue

        if platform == "linkedin":
            pid, err = await publish_to_linkedin(user_id, req.campaign_id, draft)
            if err:
                errors[platform] = err
            elif pid:
                published_ids[platform] = pid

        elif platform == "twitter":
            # Phase 1: intent URL
            twitter_intent_url = get_twitter_intent(draft)
            # Optionally save as "user_intent" status so dashboard tracks it
            db_id = await _save_published_post(
                user_id, req.campaign_id, "twitter", draft, None, "user_intent"
            )
            if db_id:
                published_ids["twitter"] = db_id

        elif platform in ("newsletter", "email"):
            # Phase 3: Beehiiv / Mailgun integration
            errors[platform] = "Newsletter publishing coming in Phase 3"

        else:
            errors[platform] = f"Unknown platform: {platform}"

    success = len(published_ids) > 0 or twitter_intent_url is not None

    return PublishResponse(
        published_post_ids=published_ids,
        twitter_intent_url=twitter_intent_url,
        success=success,
        errors=errors,
    )
