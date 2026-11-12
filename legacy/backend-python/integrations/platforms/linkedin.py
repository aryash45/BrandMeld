"""
integrations/platforms/linkedin.py — LinkedIn post publishing. [STUB — Feature 4]

TODO:
    - OAuth2 PKCE flow (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET already in config.py)
    - POST /ugcPosts via LinkedIn API v2
    - Handle token refresh
"""
from __future__ import annotations


async def post_content(access_token: str, content: str) -> dict:
    """Stub: publish a post to LinkedIn."""
    raise NotImplementedError("LinkedIn posting not yet implemented (Feature 4)")
