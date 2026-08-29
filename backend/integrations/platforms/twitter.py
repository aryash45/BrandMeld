"""
integrations/platforms/twitter.py — X/Twitter thread publishing. [STUB — Feature 4]

TODO:
    - Twitter API v2 OAuth2 (TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET in config.py)
    - POST /2/tweets for each tweet in thread with reply_to chaining
    - Handle elevated API access requirement
"""
from __future__ import annotations


async def post_thread(access_token: str, tweets: list[str]) -> dict:
    """Stub: publish a thread to X/Twitter."""
    raise NotImplementedError("Twitter posting not yet implemented (Feature 4)")
