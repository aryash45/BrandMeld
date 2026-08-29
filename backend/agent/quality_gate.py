"""
agent/quality_gate.py — Multi-stage quality validation for generated content.

Stages:
    Stage 1 (per-version): rule-based buzzword + specificity + format checks
                           + LLM authenticity scoring
    Stage 2 (cross-platform): LLM consistency check across all 3 platforms
    Stage 3 (decision): manual review flagging + ready-to-publish determination

Usage:
    gate = QualityGate()
    result = await gate.validate_platform_content(text, profile, "linkedin")
    consistency = await gate.check_consistency(linkedin, twitter, newsletter, profile)
    report = gate.build_quality_report([result_li, result_tw, result_nl], consistency)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agent.models import (
        VoiceProfile, ValidationResult, ConsistencyResult,
        GeneratedPlatformContent, QualityReport
    )

logger = logging.getLogger(__name__)


def _get_llm():
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
    from app.core.llm import get_llm_client, GenerateContentConfig, generate_content_with_retry
    return get_llm_client, GenerateContentConfig, generate_content_with_retry


class QualityGate:
    """
    Multi-stage quality validation for generated content.

    Rule-based checks are always run (fast, free, deterministic).
    LLM checks add nuanced authenticity + consistency scoring.
    """

    # ── Rule-based checks (Stage 1a) ──────────────────────────────────────────

    def check_buzzwords(self, text: str) -> list[str]:
        """Return any blacklisted buzzwords found in text (case-insensitive)."""
        from agent.config import BUZZWORD_BLACKLIST
        text_lower = text.lower()
        found = []
        for phrase in BUZZWORD_BLACKLIST:
            # Word-boundary match for single words; substring for multi-word phrases
            if " " in phrase:
                if phrase.lower() in text_lower:
                    found.append(phrase)
            else:
                if re.search(rf"\b{re.escape(phrase.lower())}\b", text_lower):
                    found.append(phrase)
        return found

    def check_specificity(self, text: str) -> str:
        """
        Heuristic specificity classification.
        Counts concrete details per 100 words and returns high/medium/low.
        """
        from agent.config import MIN_CONCRETE_DETAILS_PER_100_WORDS

        word_count = max(len(text.split()), 1)
        details = 0

        # Quantified statements: percentages, numbers, timeframes
        details += len(re.findall(r"\b\d+\.?\d*\s*%", text))                    # percentages
        details += len(re.findall(r"\$\d+[kKmMbB]?\b", text))                  # dollar amounts
        details += len(re.findall(r"\b\d+\s*(?:days?|weeks?|months?|years?)\b", text, re.I))
        details += len(re.findall(r"\b(?:v\d+|\d+\.\d+)\b", text))             # version numbers
        details += len(re.findall(r"\b\d{4}\b", text))                          # years
        details += len(re.findall(r"\b(?:\d+[kK]|\d{4,})\b", text))            # large numbers

        # Named things (tools, companies) heuristic — title-cased words not at sentence start
        named = re.findall(r"(?<=[a-z,] )([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)", text)
        details += min(len(named), 3)  # cap contribution from named things

        per_100 = (details / word_count) * 100

        if per_100 >= MIN_CONCRETE_DETAILS_PER_100_WORDS * 2:
            return "high"
        elif per_100 >= MIN_CONCRETE_DETAILS_PER_100_WORDS:
            return "medium"
        return "low"

    def check_signature_phrases(self, text: str, phrases: list[str]) -> list[str]:
        """Return which signature phrases appear in the text."""
        text_lower = text.lower()
        return [p for p in phrases if p.lower() in text_lower]

    def check_platform_format(self, text: str, platform: str) -> dict:
        """
        Check platform-specific format constraints.
        Returns dict with pass/fail per rule.
        """
        from agent.config import PLATFORM_FORMAT
        rules = PLATFORM_FORMAT.get(platform, {})
        result: dict = {"platform": platform, "issues": [], "passes": []}

        if platform == "linkedin":
            chars = len(text)
            if chars < rules.get("min_chars", 0):
                result["issues"].append(f"Too short: {chars} chars (min {rules['min_chars']})")
            elif chars > rules.get("max_chars", 99999):
                result["issues"].append(f"Too long: {chars} chars (max {rules['max_chars']})")
            else:
                result["passes"].append(f"Character count OK: {chars}")

        elif platform == "twitter":
            tweets = [l.strip() for l in text.strip().split("\n") if re.match(r"^\d+/", l.strip())]
            if len(tweets) < rules.get("min_tweets", 3):
                result["issues"].append(f"Too few tweets: {len(tweets)} (min {rules['min_tweets']})")
            elif len(tweets) > rules.get("max_tweets", 8):
                result["issues"].append(f"Too many tweets: {len(tweets)} (max {rules['max_tweets']})")
            else:
                result["passes"].append(f"Tweet count OK: {len(tweets)}")
            long_tweets = [t for t in tweets if len(t) > rules.get("max_chars_per_tweet", 280)]
            if long_tweets:
                result["issues"].append(f"{len(long_tweets)} tweet(s) exceed 280 chars")

        elif platform == "newsletter":
            words = len(text.split())
            if words < rules.get("min_words", 400):
                result["issues"].append(f"Too short: {words} words (min {rules['min_words']})")
            elif words > rules.get("max_words", 600):
                result["issues"].append(f"Too long: {words} words (max {rules['max_words']})")
            else:
                result["passes"].append(f"Word count OK: {words}")

        result["ok"] = len(result["issues"]) == 0
        return result

    # ── LLM-based authenticity scoring (Stage 1b) ─────────────────────────────

    async def score_authenticity(
        self,
        text: str,
        profile: "VoiceProfile",
        platform: str,
    ) -> "LLMAuthScore":  # noqa: F821
        """Call the LLM to get an authenticity score for the generated text."""
        from agent.models import LLMAuthScore
        from agent.prompts import (
            AUTHENTICITY_VALIDATION_SYSTEM,
            AUTHENTICITY_VALIDATION_USER_TEMPLATE,
        )
        from app.core.llm import clean_json_text

        get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()
        client = get_llm_client()

        user_msg = AUTHENTICITY_VALIDATION_USER_TEMPLATE.format(
            voice_profile=profile.to_prompt_str(),
            platform=platform,
            generated_text=text,
        )

        try:
            response = await generate_content_with_retry(
                client=client,
                contents=user_msg,
                config=GenerateContentConfig(
                    system_instruction=AUTHENTICITY_VALIDATION_SYSTEM,
                    response_mime_type="application/json",
                    response_schema=LLMAuthScore,
                    temperature=0.2,
                ),
            )
            if response.parsed is not None:
                return response.parsed
            raw = clean_json_text(response.text or "{}")
            return LLMAuthScore(**json.loads(raw))
        except Exception as exc:
            logger.warning("Authenticity scoring LLM call failed: %s", exc)
            # Fallback — conservative score so content isn't silently passed
            return LLMAuthScore(
                authenticity_score=5.0,
                red_flags=["Authenticity scoring unavailable — review manually"],
                is_authentic=False,
                confidence=0.3,
                suggestion_if_not_authentic="Manual review required: scoring service unavailable.",
            )

    # ── Combined Stage 1 validation ──────────────────────────────────────────

    async def validate_platform_content(
        self,
        text: str,
        profile: "VoiceProfile",
        platform: str,
    ) -> "ValidationResult":
        """
        Full Stage 1 validation for a single platform version.
        Runs rule-based + LLM checks, merges into ValidationResult.
        """
        from agent.models import ValidationResult
        from agent.config import MIN_SIGNATURE_PHRASES_REQUIRED

        # Rule-based (sync, instant)
        buzzwords = self.check_buzzwords(text)
        specificity = self.check_specificity(text)
        sig_phrases_found = self.check_signature_phrases(text, profile.signature_phrases)
        format_check = self.check_platform_format(text, platform)

        # LLM scoring (async)
        llm_score = await self.score_authenticity(text, profile, platform)

        # Build ValidationResult — model_validator will set needs_regeneration/review flags
        red_flags = list(llm_score.red_flags)
        green_flags = list(llm_score.green_flags)

        if buzzwords:
            red_flags.append(f"Contains buzzwords: {buzzwords}")
        if len(sig_phrases_found) < MIN_SIGNATURE_PHRASES_REQUIRED:
            red_flags.append(
                f"Only {len(sig_phrases_found)} signature phrase(s) found "
                f"(minimum {MIN_SIGNATURE_PHRASES_REQUIRED} required)"
            )
        if specificity == "low":
            red_flags.append("Low specificity: no concrete numbers, dates, or examples found")
        if format_check.get("issues"):
            red_flags.extend(format_check["issues"])
        if not buzzwords and specificity != "low":
            green_flags.append("No buzzwords detected")

        return ValidationResult(
            authenticity_score=llm_score.authenticity_score,
            red_flags=red_flags,
            green_flags=green_flags,
            signature_phrases_used=sig_phrases_found or llm_score.signature_phrases_used,
            specificity_level=specificity,
            is_authentic=llm_score.is_authentic and not buzzwords,
            confidence=llm_score.confidence,
            suggestion_if_not_authentic=llm_score.suggestion_if_not_authentic,
            has_buzzwords=buzzwords,
            format_check=format_check,
        )

    # ── Stage 2: Cross-platform consistency ──────────────────────────────────

    async def check_consistency(
        self,
        linkedin_text: str,
        twitter_text: str,
        newsletter_text: str,
        profile: "VoiceProfile",
    ) -> "ConsistencyResult":
        """
        Stage 2: Cross-platform consistency check via LLM.
        Returns ConsistencyResult with per-pair scores.
        """
        from agent.models import ConsistencyResult, PlatformPairScore
        from agent.prompts import (
            CONSISTENCY_CHECK_SYSTEM,
            CONSISTENCY_CHECK_USER_TEMPLATE,
        )
        from app.core.llm import clean_json_text

        get_llm_client, GenerateContentConfig, generate_content_with_retry = _get_llm()
        client = get_llm_client()

        user_msg = CONSISTENCY_CHECK_USER_TEMPLATE.format(
            voice_profile=profile.to_prompt_str(),
            linkedin_text=linkedin_text,
            twitter_text=twitter_text,
            newsletter_text=newsletter_text,
        )

        try:
            response = await generate_content_with_retry(
                client=client,
                contents=user_msg,
                config=GenerateContentConfig(
                    system_instruction=CONSISTENCY_CHECK_SYSTEM,
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            raw = clean_json_text(response.text or "{}")
            data = json.loads(raw)

            # Parse nested platform_consistency
            pair_scores = {}
            for pair_key, pair_val in data.get("platform_consistency", {}).items():
                if isinstance(pair_val, dict):
                    pair_scores[pair_key] = PlatformPairScore(
                        score=float(pair_val.get("score", 7.0)),
                        analysis=pair_val.get("analysis", ""),
                    )

            return ConsistencyResult(
                consistency_score=float(data.get("consistency_score", 7.0)),
                sounds_same_person=bool(data.get("sounds_same_person", True)),
                platform_consistency=pair_scores,
                overall_analysis=data.get("overall_analysis", ""),
            )
        except Exception as exc:
            logger.warning("Consistency check LLM call failed: %s", exc)
            return ConsistencyResult(
                consistency_score=5.0,
                sounds_same_person=False,
                platform_consistency={},
                overall_analysis="Consistency check unavailable — review manually.",
            )

    # ── Stage 3: Quality Report ───────────────────────────────────────────────

    def build_quality_report(
        self,
        platform_validations: dict[str, "ValidationResult"],
        consistency: "ConsistencyResult",
    ) -> "QualityReport":
        """
        Stage 3: Aggregate all validations into a QualityReport.
        Sets manual_review flags and ready_to_publish.
        """
        from agent.models import QualityReport
        from agent.config import (
            AUTHENTICITY_PASS_THRESHOLD,
            CONSISTENCY_PASS_THRESHOLD,
            MANUAL_REVIEW_IF_AUTH_BETWEEN,
            MANUAL_REVIEW_IF_CONSISTENCY_BELOW,
        )

        scores = [v.authenticity_score for v in platform_validations.values()]
        overall_auth = sum(scores) / len(scores) if scores else 5.0

        manual_review_reasons: list[str] = []
        total_buzzwords = 0

        for platform, val in platform_validations.items():
            total_buzzwords += len(val.has_buzzwords)
            if val.needs_regeneration:
                manual_review_reasons.append(
                    f"{platform}: authenticity {val.authenticity_score:.1f} < threshold "
                    f"or buzzwords found"
                )
            elif val.needs_manual_review:
                manual_review_reasons.append(
                    f"{platform}: marginal authenticity ({val.authenticity_score:.1f})"
                )

        if not consistency.sounds_same_person:
            manual_review_reasons.append("Cross-platform consistency: does not sound like same person")
        if consistency.consistency_score < MANUAL_REVIEW_IF_CONSISTENCY_BELOW:
            manual_review_reasons.append(
                f"Consistency score {consistency.consistency_score:.1f} below threshold"
            )

        needs_review = bool(manual_review_reasons)
        ready = (
            not needs_review
            and overall_auth >= AUTHENTICITY_PASS_THRESHOLD
            and consistency.consistency_score >= CONSISTENCY_PASS_THRESHOLD
            and total_buzzwords == 0
        )

        return QualityReport(
            overall_authenticity=round(overall_auth, 2),
            consistency_score=consistency.consistency_score,
            consistency_detail=consistency,
            needs_manual_review=needs_review,
            manual_review_reasons=manual_review_reasons,
            ready_to_publish=ready,
            total_buzzwords_found=total_buzzwords,
            platform_scores={p: v.authenticity_score for p, v in platform_validations.items()},
        )
