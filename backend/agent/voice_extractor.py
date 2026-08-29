"""
agent/voice_extractor.py — Founder voice signature extraction.

Analyzes raw writing samples → structured VoiceProfile with 11 authenticity markers.

Usage:
    extractor = VoiceExtractor()

    # Async
    profile = await extractor.extract(posts=["post 1...", "post 2..."])

    # Sync (CLI)
    profile = extractor.extract_sync(posts=["..."])
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agent.models import VoiceProfile

logger = logging.getLogger(__name__)


def _get_llm():
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
    from app.core.llm import get_llm_client, GenerateContentConfig, generate_content_with_retry
    return get_llm_client, GenerateContentConfig, generate_content_with_retry


class VoiceExtractor:
    """
    Extracts a founder's unique voice signature from raw writing samples.

    Produces a VoiceProfile with 11 authenticity markers that are:
    - Specific (never "professional" or "passionate")
    - Evidence-based (grounded in actual sample text)
    - Actionable (generators and validators can use them)
    """

    def _build_user_message(self, posts: list[str]) -> str:
        """Format raw posts into the extraction prompt."""
        from agent.prompts import VOICE_EXTRACTION_USER_TEMPLATE
        numbered = "\n\n".join(
            f"[SAMPLE {i + 1}]\n{post.strip()}" for i, post in enumerate(posts)
        )
        return VOICE_EXTRACTION_USER_TEMPLATE.format(samples=numbered)

    async def extract(self, posts: list[str]) -> "VoiceProfile":
        """
        Async: Extract VoiceProfile from raw writing samples.

        Args:
            posts: 3–10 raw text samples. More samples → more accurate extraction.

        Returns:
            VoiceProfile with 11 authenticity markers.

        Raises:
            ValueError: fewer than 1 post provided.
            RuntimeError: LLM call fails after retries.
        """
        from agent.models import VoiceProfile
        from agent.prompts import VOICE_EXTRACTION_SYSTEM
        from app.core.llm import clean_json_text

        if not posts:
            raise ValueError("At least one writing sample is required.")
        if len(posts) < 3:
            logger.warning(
                "Only %d sample(s) provided. 5+ recommended for accurate extraction.",
                len(posts),
            )

        get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()
        client = get_llm_client()

        logger.info("Extracting voice signature from %d writing samples…", len(posts))

        response = await generate_content_with_retry(
            client=client,
            contents=self._build_user_message(posts),
            config=GenerateContentConfig(
                system_instruction=VOICE_EXTRACTION_SYSTEM,
                response_mime_type="application/json",
                response_schema=VoiceProfile,
                temperature=0.3,
            ),
        )

        if response.parsed is not None:
            profile = response.parsed
        else:
            raw = clean_json_text(response.text or "{}")
            profile = VoiceProfile(**json.loads(raw))

        logger.info(
            "Voice extracted — authenticity: %.1f/10 | signature phrases: %d | "
            "vulnerability: %.1f/10",
            profile.authenticity_score,
            len(profile.signature_phrases),
            profile.vulnerability_level,
        )
        return profile

    def extract_sync(self, posts: list[str]) -> "VoiceProfile":
        """Sync wrapper — for use in CLI scripts."""
        return asyncio.run(self.extract(posts))


# ─── Module-level convenience functions (backward compat) ─────────────────────

def extract_voice_sync(posts: list[str]) -> "VoiceProfile":
    """Convenience wrapper around VoiceExtractor for existing callers."""
    return VoiceExtractor().extract_sync(posts)


async def extract_voice(posts: list[str]) -> "VoiceProfile":
    """Convenience wrapper around VoiceExtractor for existing callers."""
    return await VoiceExtractor().extract(posts)
