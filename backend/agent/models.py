"""
agent/models.py — Core data structures for the BrandMeld agent.

All Pydantic v2 models. Zero FastAPI or DB imports — fully portable.

Hierarchy:
    VoiceProfile         ← extracted from founder posts
    LLMAuthScore         ← intermediate LLM validation output (internal)
    ValidationResult     ← per-platform quality check (rule-based + LLM)
    GeneratedPlatformContent  ← text + validation for one platform
    ConsistencyResult    ← cross-platform consistency check
    QualityReport        ← aggregate of all validations
    ContentBundle        ← final output of the full pipeline
    EvalResult           ← result of a single eval
    EvalReport           ← result of all 7 evals
"""
from __future__ import annotations

import re
from typing import Optional
from pydantic import BaseModel, Field, model_validator


# ─── Voice Profile ─────────────────────────────────────────────────────────────

class VoiceProfile(BaseModel):
    """
    The extracted voice signature of a founder.
    Fields are deliberately specific — "professional" and "friendly" are banned.
    """
    # Core voice markers
    signature_phrases: list[str] = Field(
        default_factory=list,
        description="Exact phrases the founder repeats across posts.",
    )
    learning_mindset: str = Field(
        description="Do they discuss failures openly? Quote examples from their writing."
    )
    specificity_patterns: str = Field(
        description="Do they use numbers/stories/details or stay vague? Be specific."
    )
    personality_markers: str = Field(
        description="Uniquely THEIRS — not 'professional' or 'passionate'. Specific quirks."
    )
    what_they_dont_do: list[str] = Field(
        default_factory=list,
        description="Behaviors, phrases, or styles that feel out-of-character.",
    )

    # Authenticity metadata
    authenticity_score: float = Field(
        ge=1.0, le=10.0,
        description="How distinct/extractable is this voice? 1=generic, 10=unmistakable.",
    )
    why_authentic: str = Field(
        description="Explanation of what makes this voice unique and extractable."
    )

    # Depth markers
    technical_depth: str = Field(
        description="beginner / intermediate / expert — with example from their writing.",
    )
    vulnerability_level: float = Field(
        ge=1.0, le=10.0,
        description="1=never admits mistakes, 10=fully open about failures.",
    )
    humor_style: str = Field(
        description="Type of humor (self-deprecating, dry, none, absurdist, etc.) + example.",
    )
    core_values: list[str] = Field(
        default_factory=list,
        description="Beliefs that consistently come through their writing.",
    )
    example_voice_sample: str = Field(
        description="One sentence written in their authentic voice as a reference anchor."
    )

    # Derived helpers (not from LLM — computed)
    banned_phrases: list[str] = Field(
        default_factory=list,
        description="Words/phrases that feel inauthentic to this specific voice.",
    )

    def to_prompt_str(self) -> str:
        """Format for injection into generation/validation prompts."""
        phrases = "\n".join(f"  - \"{p}\"" for p in self.signature_phrases) or "  - (none found)"
        wont_do = "\n".join(f"  - {d}" for d in self.what_they_dont_do) or "  - (none)"
        values = ", ".join(self.core_values) or "not identified"
        banned = ", ".join(self.banned_phrases) or "none"
        return (
            f"SIGNATURE PHRASES (use these naturally):\n{phrases}\n\n"
            f"PERSONALITY MARKERS: {self.personality_markers}\n\n"
            f"LEARNING MINDSET: {self.learning_mindset}\n\n"
            f"SPECIFICITY PATTERNS: {self.specificity_patterns}\n\n"
            f"TECHNICAL DEPTH: {self.technical_depth}\n\n"
            f"VULNERABILITY LEVEL: {self.vulnerability_level}/10 — {self.learning_mindset}\n\n"
            f"HUMOR STYLE: {self.humor_style}\n\n"
            f"CORE VALUES: {values}\n\n"
            f"WHAT THEY DON'T DO:\n{wont_do}\n\n"
            f"BANNED PHRASES (never use): {banned}\n\n"
            f"VOICE SUMMARY: {self.why_authentic}\n\n"
            f"EXAMPLE SENTENCE IN THEIR VOICE: \"{self.example_voice_sample}\""
        )


# ─── Intermediate LLM output (internal — not exposed in final output) ──────────

class LLMAuthScore(BaseModel):
    """
    What the LLM returns when we ask it to score authenticity.
    We then merge this with rule-based checks to form ValidationResult.
    """
    authenticity_score: float = Field(ge=1.0, le=10.0)
    red_flags: list[str] = Field(default_factory=list)
    green_flags: list[str] = Field(default_factory=list)
    signature_phrases_used: list[str] = Field(default_factory=list)
    specificity_level: str = Field(default="medium")  # high / medium / low
    is_authentic: bool = Field(default=True)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    suggestion_if_not_authentic: str = Field(default="")


# ─── Consistency Result (LLM cross-platform check) ────────────────────────────

class PlatformPairScore(BaseModel):
    score: float = Field(ge=1.0, le=10.0)
    analysis: str


class ConsistencyResult(BaseModel):
    consistency_score: float = Field(ge=1.0, le=10.0)
    sounds_same_person: bool
    platform_consistency: dict[str, PlatformPairScore] = Field(default_factory=dict)
    overall_analysis: str


# ─── Validation Result ────────────────────────────────────────────────────────

class ValidationResult(BaseModel):
    """
    Full quality check for a single platform version.
    Merges LLM scoring with rule-based checks.
    """
    # From LLM
    authenticity_score: float = Field(ge=1.0, le=10.0)
    red_flags: list[str] = Field(default_factory=list)
    green_flags: list[str] = Field(default_factory=list)
    signature_phrases_used: list[str] = Field(default_factory=list)
    specificity_level: str = Field(default="medium")
    is_authentic: bool = Field(default=True)
    confidence: float = Field(default=0.8)
    suggestion_if_not_authentic: str = Field(default="")

    # From rule-based checks
    has_buzzwords: list[str] = Field(
        default_factory=list,
        description="Buzzwords found in the text. Empty = clean.",
    )
    format_check: dict = Field(
        default_factory=dict,
        description="Platform format validation results.",
    )

    # Computed decisions (set after merging)
    needs_regeneration: bool = Field(default=False)
    needs_manual_review: bool = Field(default=False)

    @model_validator(mode="after")
    def _compute_flags(self) -> "ValidationResult":
        from agent.config import (
            AUTHENTICITY_FAIL_THRESHOLD,
            AUTHENTICITY_MARGINAL_LOW,
            AUTHENTICITY_PASS_THRESHOLD,
            MANUAL_REVIEW_IF_CONFIDENCE_BELOW,
        )
        # Auto-flag
        if (
            self.authenticity_score < AUTHENTICITY_FAIL_THRESHOLD
            or bool(self.has_buzzwords)
        ):
            object.__setattr__(self, "needs_regeneration", True)
        if (
            AUTHENTICITY_MARGINAL_LOW <= self.authenticity_score < AUTHENTICITY_PASS_THRESHOLD
            or self.confidence < MANUAL_REVIEW_IF_CONFIDENCE_BELOW
        ):
            object.__setattr__(self, "needs_manual_review", True)
        return self


# ─── Per-Platform Generated Content ───────────────────────────────────────────

class GeneratedPlatformContent(BaseModel):
    text: str
    validation: Optional[ValidationResult] = None
    regeneration_count: int = Field(default=0)
    word_count: int = Field(default=0)
    char_count: int = Field(default=0)

    @model_validator(mode="after")
    def _compute_counts(self) -> "GeneratedPlatformContent":
        if self.text:
            object.__setattr__(self, "word_count", len(self.text.split()))
            object.__setattr__(self, "char_count", len(self.text))
        return self


# ─── Quality Report ───────────────────────────────────────────────────────────

class QualityReport(BaseModel):
    overall_authenticity: float = Field(ge=1.0, le=10.0)
    consistency_score: float = Field(ge=1.0, le=10.0)
    consistency_detail: Optional[ConsistencyResult] = None
    needs_manual_review: bool = Field(default=False)
    manual_review_reasons: list[str] = Field(default_factory=list)
    ready_to_publish: bool = Field(default=False)
    total_buzzwords_found: int = Field(default=0)
    platform_scores: dict[str, float] = Field(default_factory=dict)


# ─── Full Content Bundle (final pipeline output) ──────────────────────────────

class ContentBundle(BaseModel):
    """
    The complete output of the Feature 1 pipeline.
    One ContentBundle per agent run.
    """
    new_content: str = Field(description="The original topic/announcement.")
    voice_profile: VoiceProfile
    linkedin: Optional[GeneratedPlatformContent] = None
    twitter: Optional[GeneratedPlatformContent] = None
    newsletter: Optional[GeneratedPlatformContent] = None
    quality_report: Optional[QualityReport] = None

    def get_platform(self, platform: str) -> Optional[GeneratedPlatformContent]:
        return getattr(self, platform, None)

    def all_platforms(self) -> list[tuple[str, GeneratedPlatformContent]]:
        result = []
        for p in ("linkedin", "twitter", "newsletter"):
            v = getattr(self, p)
            if v:
                result.append((p, v))
        return result

    def print_summary(self) -> None:
        """Human-readable CLI output."""
        print(f"\n{'='*65}")
        print(f"  BRANDMELD CONTENT BUNDLE")
        print(f"{'='*65}")
        print(f"  Topic: {self.new_content[:80]}{'…' if len(self.new_content) > 80 else ''}")
        if self.quality_report:
            qr = self.quality_report
            status = "✅ READY" if qr.ready_to_publish else "⚠️  NEEDS REVIEW"
            print(f"  Status: {status}")
            print(f"  Overall Authenticity: {qr.overall_authenticity:.1f}/10")
            print(f"  Consistency: {qr.consistency_score:.1f}/10")
            if qr.total_buzzwords_found:
                print(f"  ⚠️  Buzzwords found: {qr.total_buzzwords_found}")
        print(f"{'='*65}")

        for platform, content in self.all_platforms():
            print(f"\n{'─'*40}")
            print(f"  === {platform.upper()} ===")
            if content.validation:
                v = content.validation
                auth_emoji = "✅" if v.authenticity_score >= 7 else ("⚠️" if v.authenticity_score >= 5 else "❌")
                print(f"  {auth_emoji} Authenticity: {v.authenticity_score:.1f}/10 | "
                      f"Specificity: {v.specificity_level}")
                if v.has_buzzwords:
                    print(f"  🚫 Buzzwords: {v.has_buzzwords}")
                if content.regeneration_count:
                    print(f"  🔄 Regenerated {content.regeneration_count}×")
            print(f"{'─'*40}")
            print(content.text)

        if self.quality_report and self.quality_report.manual_review_reasons:
            print(f"\n⚠️  Manual Review Required:")
            for reason in self.quality_report.manual_review_reasons:
                print(f"   - {reason}")


# ─── Eval Infrastructure ──────────────────────────────────────────────────────

class EvalTestCase(BaseModel):
    name: str
    input_text: str
    expected_pass: bool
    expected_score_min: Optional[float] = None
    expected_score_max: Optional[float] = None
    expected_buzzwords_found: Optional[list[str]] = None
    notes: str = ""


class EvalResult(BaseModel):
    eval_id: str
    eval_name: str
    status: str                          # "PASS" / "FAIL" / "MARGINAL"
    score: float = Field(ge=0.0, le=10.0)
    details: str
    test_cases: list[dict] = Field(default_factory=list)
    passed_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0


class EvalReport(BaseModel):
    eval_timestamp: str
    evals_run: int
    results: dict[str, EvalResult] = Field(default_factory=dict)
    overall_status: str                  # "PASS" / "FAIL" / "PARTIAL"
    overall_score: float
    summary: str
    api_calls_made: int = 0
    total_time_seconds: float = 0.0
