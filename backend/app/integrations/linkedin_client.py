"""
integrations/linkedin_client.py — LinkedIn UGC Posts API client.

Uses the LinkedIn v2 API with OAuth 2.0 (w_member_social scope).
OAuth flow:
  1. Redirect user to LinkedIn auth URL
  2. LinkedIn calls back to /v1/auth/linkedin/callback with ?code=...
  3. Exchange code for access_token, store encrypted in connected_accounts
"""
from __future__ import annotations
import logging
from typing import Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

_LINKEDIN_API = "https://api.linkedin.com/v2"
_LINKEDIN_AUTH = "https://www.linkedin.com/oauth/v2"


class LinkedInClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

    async def get_profile(self) -> dict:
        """Fetch the authenticated user's LinkedIn profile."""
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{_LINKEDIN_API}/me", headers=self._headers)
            r.raise_for_status()
            return r.json()

    async def create_post(self, text: str, author_urn: str) -> dict:
        """
        Publish a text post via ugcPosts endpoint.
        author_urn: 'urn:li:person:{person_id}' (from get_profile).
        Returns: {id, created_at}
        """
        payload = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            },
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_LINKEDIN_API}/ugcPosts",
                headers=self._headers,
                json=payload,
            )
            r.raise_for_status()
            return {"id": r.headers.get("x-restli-id", ""), "status": "published"}

    async def get_post_metrics(self, post_id: str) -> dict:
        """Fetch likes, shares, comments, impressions for a post."""
        encoded = httpx.URL(post_id).encode("utf-8").decode()
        async with httpx.AsyncClient(timeout=10) as client:
            # Social metadata (likes, shares, comments)
            r = await client.get(
                f"{_LINKEDIN_API}/socialMetadata/{encoded}",
                headers=self._headers,
            )
            if r.status_code == 200:
                data = r.json()
                return {
                    "likes": data.get("numLikes", 0),
                    "shares": data.get("numShares", 0),
                    "comments": data.get("numComments", 0),
                    "impressions": 0,  # requires analytics API
                }
        return {"likes": 0, "shares": 0, "comments": 0, "impressions": 0}


def build_linkedin_auth_url(state: str) -> str:
    """Build OAuth 2.0 authorization URL."""
    settings = get_settings()
    params = httpx.QueryParams({
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "state": state,
        "scope": "openid profile w_member_social",
    })
    return f"{_LINKEDIN_AUTH}/authorization?{params}"


async def exchange_linkedin_code(code: str) -> dict:
    """Exchange OAuth code for access_token."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{_LINKEDIN_AUTH}/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
                "redirect_uri": settings.linkedin_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        r.raise_for_status()
        return r.json()  # {access_token, expires_in, ...}
