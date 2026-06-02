"""
core/gemini.py — Shared Gemini client factory and retry helper.

All services that call Gemini should import from here instead of
constructing their own genai.Client inline.
"""
from __future__ import annotations

import asyncio
import logging
import os

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

DEFAULT_MODEL_ID = "gemini-2.5-flash"
GEMINI_RETRY_DELAYS = (1.0, 2.0, 4.0)


def get_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set")
    return key


def get_model_id() -> str:
    return os.getenv("GEMINI_MODEL_ID", DEFAULT_MODEL_ID)


def get_gemini_client() -> genai.Client:
    """Return a configured google-genai Client (new SDK)."""
    return genai.Client(api_key=get_api_key())


def is_retryable_gemini_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "503 unavailable" in message
        or "'status': 'unavailable'" in message
        or '"status": "unavailable"' in message
        or "currently experiencing high demand" in message
    )


async def generate_content_with_retry(
    *,
    client: genai.Client,
    contents,
    config: genai_types.GenerateContentConfig,
) -> genai_types.GenerateContentResponse:
    """Call Gemini with exponential backoff on transient 503 errors."""
    model_id = get_model_id()
    last_exc: Exception | None = None

    for attempt, delay in enumerate((0.0, *GEMINI_RETRY_DELAYS), start=1):
        if delay:
            await asyncio.sleep(delay)
        try:
            return await asyncio.to_thread(
                lambda: client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=config,
                )
            )
        except Exception as exc:
            last_exc = exc
            if not is_retryable_gemini_error(exc):
                raise
            logger.warning(
                "Gemini transient error (attempt %d/%d): %s",
                attempt,
                len(GEMINI_RETRY_DELAYS) + 1,
                exc,
            )

    raise RuntimeError(f"Gemini unavailable after {len(GEMINI_RETRY_DELAYS) + 1} attempts") from last_exc
