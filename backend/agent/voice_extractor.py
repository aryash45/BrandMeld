"""
agent/voice_extractor.py — Founder voice signature extraction.

Takes a list of raw text samples written by a founder and returns a structured
VoiceProfile by calling the NVIDIA NIM API.

Usage:
    from agent.voice_extractor import extract_voice, extract_voice_sync

    # Async (preferred in async contexts)
    profile = await extract_voice(posts=["I shipped v2 today...", "Hot take: ..."])

    # Sync (for CLI scripts)
    profile = extract_voice_sync(posts=["..."])
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import os

logger = logging.getLogger(__name__)


def _get_llm():
    """Lazy import so the agent module is importable without NVIDIA_API_KEY set."""
    # Resolve the backend/ root so we can import app.core.llm regardless of cwd
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)

    from app.core.llm import (
        get_llm_client,
        GenerateContentConfig,
        generate_content_with_retry,
    )
    return get_llm_client, GenerateContentConfig, generate_content_with_retry


def _build_extraction_prompt(posts: list[str]) -> str:
    """Format raw post samples into the LLM prompt."""
    numbered = "\n\n".join(
        f"[SAMPLE {i + 1}]\n{post.strip()}" for i, post in enumerate(posts)
    )
    return (
        "Analyze the following writing samples from a single founder/creator.\n"
        "Extract their unique voice signature and return it as JSON matching this schema:\n\n"
        "{\n"
        '  "tone": "string",\n'
        '  "vocabulary_style": "string",\n'
        '  "sentence_structure": "string",\n'
        '  "recurring_themes": ["string", ...],\n'
        '  "banned_phrases": ["string", ...],\n'
        '  "signature_phrases": ["string", ...],\n'
        '  "pov_summary": "string"\n'
        "}\n\n"
        "WRITING SAMPLES:\n"
        f"{numbered}"
    )


async def extract_voice(posts: list[str]) -> "VoiceProfile":  # noqa: F821
    """
    Async: Analyze raw founder posts and return a VoiceProfile.

    Args:
        posts: List of raw text samples (tweets, LinkedIn posts, blog excerpts, etc.)
               Minimum 3 samples recommended for accurate extraction.

    Returns:
        VoiceProfile — structured voice signature.

    Raises:
        ValueError: If no posts provided.
        RuntimeError: If the LLM call fails after retries.
    """
    from agent.models import VoiceProfile
    from agent.prompts import VOICE_EXTRACTOR_SYSTEM
    from app.core.llm import clean_json_text

    if not posts:
        raise ValueError("At least one writing sample is required for voice extraction.")

    get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()

    client = get_llm_client()
    prompt = _build_extraction_prompt(posts)

    logger.info("Extracting voice from %d writing samples…", len(posts))

    response = await generate_content_with_retry(
        client=client,
        contents=prompt,
        config=GenerateContentConfig(
            system_instruction=VOICE_EXTRACTOR_SYSTEM,
            response_mime_type="application/json",
            response_schema=VoiceProfile,
            temperature=0.3,  # low temp for consistent, evidence-based extraction
        ),
    )

    # Prefer structured parse; fall back to manual JSON decode
    if response.parsed is not None:
        return response.parsed

    raw_text = clean_json_text(response.text or "{}")
    data = json.loads(raw_text)
    return VoiceProfile(**data)


def extract_voice_sync(posts: list[str]) -> "VoiceProfile":  # noqa: F821
    """
    Sync wrapper around extract_voice — for use in CLI scripts.

    Args:
        posts: List of raw text samples.

    Returns:
        VoiceProfile
    """
    return asyncio.run(extract_voice(posts))
