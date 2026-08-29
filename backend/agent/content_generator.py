"""
agent/content_generator.py — Multi-platform content generation.

Takes a VoiceProfile + topic and generates platform-specific content in parallel.
Includes an internal self-correction pass (transparent to the caller).

Usage:
    from agent.content_generator import generate_content, generate_content_sync
    from agent.models import VoiceProfile

    bundle = await generate_content(
        voice=profile,
        topic="We just shipped async exports — took 3 weeks to get right.",
        platforms=["twitter", "linkedin", "newsletter"],
    )
    bundle.print_summary()
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

logger = logging.getLogger(__name__)


def _get_llm():
    """Lazy import — keeps agent importable without env vars set."""
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)

    from app.core.llm import (
        get_llm_client,
        GenerateContentConfig,
        generate_content_with_retry,
    )
    return get_llm_client, GenerateContentConfig, generate_content_with_retry


def _build_generation_prompt(voice_str: str, topic: str, platform: str) -> str:
    """Compose the per-platform generation prompt."""
    from agent.prompts import PLATFORM_CONSTRAINTS
    constraints = PLATFORM_CONSTRAINTS.get(platform, "Write appropriate content for this platform.")
    return (
        f"[BRAND_VOICE]\n"
        f"---\n{voice_str}\n---\n\n"
        f"[CONTENT TOPIC]\n"
        f"---\n{topic}\n---\n\n"
        f"[PLATFORM REQUIREMENTS — FOLLOW STRICTLY]\n"
        f"---\n{constraints}\n---"
    )


def _build_audit_prompt(draft: str, voice_str: str) -> str:
    """Prompt for the internal self-correction pass."""
    return f"[VOICE PROFILE]\n{voice_str}\n\n[DRAFT]\n{draft}"


async def _self_correct(draft: str, voice_str: str) -> tuple[str, bool]:
    """
    Internal audit pass: rewrite only off-brand sentences.

    Returns:
        (corrected_draft, was_changed)
    """
    from agent.prompts import AUDITOR_SYSTEM

    get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()
    client = get_llm_client()

    resp = await generate_content_with_retry(
        client=client,
        contents=_build_audit_prompt(draft, voice_str),
        config=GenerateContentConfig(
            system_instruction=AUDITOR_SYSTEM,
            temperature=0.4,
            top_p=0.9,
        ),
    )
    corrected = (resp.text or "").strip() or draft
    return corrected, (corrected != draft)


async def _generate_for_platform(
    voice_str: str,
    topic: str,
    platform: str,
) -> tuple[str, str, bool]:
    """
    Generate + self-correct content for a single platform.

    Returns:
        (platform, content, self_corrected)
    """
    from agent.prompts import GENERATOR_SYSTEM

    get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()
    client = get_llm_client()

    prompt = _build_generation_prompt(voice_str, topic, platform)

    logger.info("Generating %s content…", platform)
    resp = await generate_content_with_retry(
        client=client,
        contents=prompt,
        config=GenerateContentConfig(
            system_instruction=GENERATOR_SYSTEM,
            temperature=0.8,
            top_p=0.95,
        ),
    )
    draft = (resp.text or "").strip()

    # Internal audit pass — transparent to caller
    corrected, changed = await _self_correct(draft, voice_str)
    return platform, corrected, changed


async def generate_content(
    voice: "VoiceProfile",  # noqa: F821
    topic: str,
    platforms: list[str] | None = None,
) -> "ContentBundle":  # noqa: F821
    """
    Async: Generate multi-platform content for a given topic in the founder's voice.

    Args:
        voice:     VoiceProfile extracted by voice_extractor.extract_voice()
        topic:     The subject/update to create content about
        platforms: List of target platforms. Defaults to ["twitter", "linkedin", "newsletter"]

    Returns:
        ContentBundle with per-platform results and any errors.
    """
    from agent.models import ContentBundle, GeneratedContent
    from agent.prompts import PLATFORM_CONSTRAINTS

    if platforms is None:
        platforms = ["twitter", "linkedin", "newsletter"]

    # Filter to supported platforms only
    valid_platforms = [p for p in platforms if p in PLATFORM_CONSTRAINTS]
    unsupported = [p for p in platforms if p not in PLATFORM_CONSTRAINTS]
    if unsupported:
        logger.warning("Unsupported platforms ignored: %s", unsupported)

    voice_str = voice.to_prompt_str()

    # Run all platforms in parallel
    tasks = [_generate_for_platform(voice_str, topic, p) for p in valid_platforms]
    task_results = await asyncio.gather(*tasks, return_exceptions=True)

    results: dict[str, GeneratedContent] = {}
    errors: dict[str, str] = {}

    for platform, result in zip(valid_platforms, task_results):
        if isinstance(result, Exception):
            logger.error("Failed to generate %s content: %s", platform, result)
            errors[platform] = str(result)
        else:
            plat, content, corrected = result
            results[plat] = GeneratedContent(
                platform=plat,
                content=content,
                self_corrected=corrected,
            )

    return ContentBundle(
        topic=topic,
        voice_profile=voice,
        results=results,
        errors=errors,
    )


def generate_content_sync(
    voice: "VoiceProfile",  # noqa: F821
    topic: str,
    platforms: list[str] | None = None,
) -> "ContentBundle":  # noqa: F821
    """
    Sync wrapper around generate_content — for use in CLI scripts.
    """
    return asyncio.run(generate_content(voice=voice, topic=topic, platforms=platforms))
