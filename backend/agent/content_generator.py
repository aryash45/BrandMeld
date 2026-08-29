"""
agent/content_generator.py — Multi-platform content generation with validation loop.

Process per platform:
    1. Generate initial draft
    2. Validate against quality gate (buzzwords + specificity + LLM auth score)
    3. If score < 7, regenerate with stricter prompt (max 2 attempts)
    4. Return GeneratedPlatformContent with embedded ValidationResult

Usage:
    generator = ContentGenerator()

    bundle = await generator.generate(
        voice=profile,
        topic="We just shipped async exports after 3 weeks of work.",
        platforms=["linkedin", "twitter", "newsletter"],
    )
    bundle.print_summary()
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agent.models import VoiceProfile, ContentBundle, GeneratedPlatformContent

logger = logging.getLogger(__name__)


def _get_llm():
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
    from app.core.llm import get_llm_client, GenerateContentConfig, generate_content_with_retry
    return get_llm_client, GenerateContentConfig, generate_content_with_retry


class ContentGenerator:
    """
    Generates platform-native content in a founder's voice, with a validation
    loop that catches and regenerates slop before it reaches the output.
    """

    def _build_prompt(self, voice_str: str, topic: str, platform: str) -> str:
        """Select the right per-platform prompt template and fill it in."""
        from agent.prompts import (
            LINKEDIN_PROMPT_TEMPLATE,
            TWITTER_PROMPT_TEMPLATE,
            NEWSLETTER_PROMPT_TEMPLATE,
            GENERATOR_SYSTEM,  # noqa — used via config
        )
        from agent.config import BUZZWORD_BLACKLIST

        buzzwords_short = ", ".join(BUZZWORD_BLACKLIST[:12]) + "..."

        templates = {
            "linkedin": LINKEDIN_PROMPT_TEMPLATE,
            "twitter": TWITTER_PROMPT_TEMPLATE,
            "newsletter": NEWSLETTER_PROMPT_TEMPLATE,
        }
        template = templates.get(platform, LINKEDIN_PROMPT_TEMPLATE)
        return template.format(voice_profile=voice_str, topic=topic)

    def _build_stricter_prompt(
        self,
        voice_str: str,
        topic: str,
        platform: str,
        profile: "VoiceProfile",
    ) -> str:
        """Stricter regeneration prompt when the first attempt scored < 7."""
        from agent.prompts import STRICTER_GENERATOR_SUFFIX
        base = self._build_prompt(voice_str, topic, platform)
        phrases_str = ", ".join(f'"{p}"' for p in profile.signature_phrases[:4])
        suffix = STRICTER_GENERATOR_SUFFIX.format(
            signature_phrases=phrases_str,
            example_voice_sample=profile.example_voice_sample,
        )
        return base + suffix

    async def _generate_raw(
        self,
        voice_str: str,
        topic: str,
        platform: str,
        stricter: bool = False,
        profile: "VoiceProfile | None" = None,
    ) -> str:
        """Single LLM generation call. Returns raw text."""
        from agent.prompts import GENERATOR_SYSTEM
        from agent.config import BUZZWORD_BLACKLIST

        buzzwords_short = ", ".join(BUZZWORD_BLACKLIST[:12]) + "..."
        system = GENERATOR_SYSTEM.format(buzzwords=buzzwords_short)

        if stricter and profile is not None:
            prompt = self._build_stricter_prompt(voice_str, topic, platform, profile)
        else:
            prompt = self._build_prompt(voice_str, topic, platform)

        get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()
        client = get_llm_client()

        resp = await generate_content_with_retry(
            client=client,
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=system,
                temperature=0.85 if not stricter else 0.75,
                top_p=0.95,
            ),
        )
        return (resp.text or "").strip()

    async def _generate_for_platform(
        self,
        voice: "VoiceProfile",
        topic: str,
        platform: str,
    ) -> "GeneratedPlatformContent":
        """
        Generate content for a single platform with the validation retry loop.

        Attempts up to MAX_REGENERATION_ATTEMPTS regenerations if the draft
        fails the quality gate. After that, returns the best version with
        manual review flagged.
        """
        from agent.models import GeneratedPlatformContent, ValidationResult
        from agent.quality_gate import QualityGate
        from agent.config import MAX_REGENERATION_ATTEMPTS, AUTHENTICITY_PASS_THRESHOLD

        gate = QualityGate()
        voice_str = voice.to_prompt_str()

        best_text = ""
        best_validation: ValidationResult | None = None
        regen_count = 0

        for attempt in range(MAX_REGENERATION_ATTEMPTS + 1):
            stricter = attempt > 0
            logger.info(
                "Generating %s content (attempt %d/%d)%s",
                platform.upper(),
                attempt + 1,
                MAX_REGENERATION_ATTEMPTS + 1,
                " [STRICTER]" if stricter else "",
            )

            text = await self._generate_raw(
                voice_str, topic, platform,
                stricter=stricter, profile=voice if stricter else None,
            )

            if not text:
                logger.warning("Empty response from LLM for %s attempt %d", platform, attempt + 1)
                continue

            validation = await gate.validate_platform_content(text, voice, platform)
            best_text = text
            best_validation = validation

            if not validation.needs_regeneration:
                logger.info(
                    "%s passed quality gate on attempt %d (score: %.1f)",
                    platform.upper(), attempt + 1, validation.authenticity_score,
                )
                break

            if attempt < MAX_REGENERATION_ATTEMPTS:
                regen_count += 1
                logger.info(
                    "%s failed quality gate (score: %.1f, buzzwords: %s) — regenerating…",
                    platform.upper(),
                    validation.authenticity_score,
                    validation.has_buzzwords,
                )
        else:
            logger.warning(
                "%s still failing after %d attempts — flagging for manual review.",
                platform.upper(),
                MAX_REGENERATION_ATTEMPTS + 1,
            )
            if best_validation:
                # Force manual review flag
                best_validation.needs_manual_review = True

        return GeneratedPlatformContent(
            text=best_text,
            validation=best_validation,
            regeneration_count=regen_count,
        )

    async def generate(
        self,
        voice: "VoiceProfile",
        topic: str,
        platforms: list[str] | None = None,
    ) -> "ContentBundle":
        """
        Async: Generate and validate multi-platform content.

        Args:
            voice:     VoiceProfile from VoiceExtractor
            topic:     The subject/update to generate content about
            platforms: Target platforms (default: linkedin, twitter, newsletter)

        Returns:
            ContentBundle with validated per-platform content + quality report
        """
        from agent.models import ContentBundle
        from agent.quality_gate import QualityGate
        from agent.prompts import PLATFORM_CONSTRAINTS

        if platforms is None:
            platforms = ["linkedin", "twitter", "newsletter"]

        valid_platforms = [p for p in platforms if p in PLATFORM_CONSTRAINTS]
        if skipped := [p for p in platforms if p not in PLATFORM_CONSTRAINTS]:
            logger.warning("Skipping unsupported platforms: %s", skipped)

        # Generate all platforms in parallel
        tasks = {p: self._generate_for_platform(voice, topic, p) for p in valid_platforms}
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        platform_content: dict[str, "GeneratedPlatformContent"] = {}

        for platform, result in zip(tasks.keys(), results):
            if isinstance(result, Exception):
                logger.error("Platform %s generation failed: %s", platform, result)
            else:
                platform_content[platform] = result

        # Stage 2: consistency check (only if we have all 3 main platforms)
        gate = QualityGate()
        consistency = await gate.check_consistency(
            linkedin_text=platform_content.get("linkedin", _empty()).text,
            twitter_text=platform_content.get("twitter", _empty()).text,
            newsletter_text=platform_content.get("newsletter", _empty()).text,
            profile=voice,
        )

        # Stage 3: quality report
        validations = {
            p: c.validation
            for p, c in platform_content.items()
            if c.validation is not None
        }
        quality_report = gate.build_quality_report(validations, consistency)

        return ContentBundle(
            new_content=topic,
            voice_profile=voice,
            linkedin=platform_content.get("linkedin"),
            twitter=platform_content.get("twitter"),
            newsletter=platform_content.get("newsletter"),
            quality_report=quality_report,
        )

    def generate_sync(
        self,
        voice: "VoiceProfile",
        topic: str,
        platforms: list[str] | None = None,
    ) -> "ContentBundle":
        """Sync wrapper — for CLI scripts."""
        return asyncio.run(self.generate(voice=voice, topic=topic, platforms=platforms))


def _empty():
    """Return an empty GeneratedPlatformContent for missing platforms in consistency check."""
    from agent.models import GeneratedPlatformContent
    return GeneratedPlatformContent(text="[not generated]")


# ─── Backward-compat module-level functions ────────────────────────────────────

async def generate_content(
    voice: "VoiceProfile",
    topic: str,
    platforms: list[str] | None = None,
) -> "ContentBundle":
    return await ContentGenerator().generate(voice=voice, topic=topic, platforms=platforms)


def generate_content_sync(
    voice: "VoiceProfile",
    topic: str,
    platforms: list[str] | None = None,
) -> "ContentBundle":
    return ContentGenerator().generate_sync(voice=voice, topic=topic, platforms=platforms)
