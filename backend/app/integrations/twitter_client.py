"""
integrations/twitter_client.py — X (Twitter) integration.

Phase 1: Web Intent URL only (no API key needed).
Phase 3: Full v2 API posting when Elevated access is obtained.

The intent URL approach:
  - Pre-fills X composer with draft text
  - User reviews and tweets manually
  - Zero API dependency, zero rate limits
"""
from __future__ import annotations
import urllib.parse
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_INTENT_BASE = "https://twitter.com/intent/tweet"
_MAX_TWEET_CHARS = 280


def build_tweet_intent_url(text: str) -> str:
    """
    Build a twitter.com/intent/tweet URL with text pre-filled.
    If text > 280 chars, truncates with '...' and adds a hint.
    """
    if len(text) > _MAX_TWEET_CHARS:
        # Truncate for intent; user can expand in composer
        safe = text[:_MAX_TWEET_CHARS - 3] + "..."
        logger.info("Tweet text truncated for intent URL (%d → %d chars)", len(text), len(safe))
    else:
        safe = text

    return f"{_INTENT_BASE}?{urllib.parse.urlencode({'text': safe})}"


def build_thread_intent_urls(tweets: list[str]) -> list[str]:
    """Build intent URLs for each tweet in a thread."""
    return [build_tweet_intent_url(t) for t in tweets]


def split_into_thread(text: str) -> list[str]:
    """
    Split long content into numbered tweets (1/, 2/, etc.).
    Each tweet ≤ 280 chars including the number prefix.
    """
    prefix_len = 5   # "N/ " worst case for single-digit threads
    chunk_size = _MAX_TWEET_CHARS - prefix_len

    words = text.split()
    tweets: list[str] = []
    current: list[str] = []
    current_len = 0

    for word in words:
        word_len = len(word) + 1  # +1 for space
        if current_len + word_len > chunk_size and current:
            tweets.append(" ".join(current))
            current = [word]
            current_len = word_len
        else:
            current.append(word)
            current_len += word_len

    if current:
        tweets.append(" ".join(current))

    # Add numbering prefix
    total = len(tweets)
    if total > 1:
        tweets = [f"{i + 1}/{total} {t}" for i, t in enumerate(tweets)]

    return tweets


# ── Phase 3 stub — real API posting (requires Elevated access) ─────────────
class TwitterAPIClient:
    """
    Stub for full X API v2 posting.
    Activate in Phase 3 when Elevated developer access is obtained.
    """
    def __init__(self, access_token: str, access_token_secret: str):
        self.access_token = access_token
        self.access_token_secret = access_token_secret
        # TODO Phase 3: import tweepy; self.client = tweepy.Client(...)

    async def create_tweet(self, text: str) -> dict:
        raise NotImplementedError("X API posting requires Elevated access (Phase 3).")

    async def get_tweet_metrics(self, tweet_id: str) -> dict:
        raise NotImplementedError("X API metrics require Elevated access (Phase 3).")
