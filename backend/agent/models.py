"""
agent/models.py — Core data structures for the BrandMeld agent.

All Pydantic v2 models. No FastAPI or DB dependencies — importable anywhere.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ─── Input models ─────────────────────────────────────────────────────────────


class FounderPost(BaseModel):
    """A single raw post/text sample written by the founder."""
    text: str = Field(min_length=1, max_length=5000)
    platform: str = Field(default="unknown")  # "linkedin", "twitter", "blog", etc.


class ContentRequest(BaseModel):
    """What the agent should generate content about."""
    topic: str = Field(
        min_length=1,
        max_length=3000,
        description="The topic, update, or idea to create content for.",
    )
    platforms: list[str] = Field(
        default_factory=lambda: ["twitter", "linkedin", "newsletter"],
        description="Target platforms. Must be in PLATFORM_CONSTRAINTS keys.",
    )


# ─── Voice models ─────────────────────────────────────────────────────────────


class VoiceProfile(BaseModel):
    """
    The extracted voice signature of a founder.
    Derived from analyzing their raw writing samples.
    """
    tone: str = Field(
        description="Overall emotional register, e.g. 'direct and opinionated' or 'warm and self-deprecating'."
    )
    vocabulary_style: str = Field(
        description="Word choice patterns, jargon, complexity level, e.g. 'technical but plain-spoken'."
    )
    sentence_structure: str = Field(
        description="How they form sentences, e.g. 'short punchy bursts, rarely uses subordinate clauses'."
    )
    recurring_themes: list[str] = Field(
        default_factory=list,
        description="Topics, beliefs, or frameworks they return to repeatedly.",
    )
    banned_phrases: list[str] = Field(
        default_factory=list,
        description="Words or phrases that feel inauthentic to this voice. Avoid these.",
    )
    signature_phrases: list[str] = Field(
        default_factory=list,
        description="Expressions or framings that are distinctly theirs.",
    )
    pov_summary: str = Field(
        description="One-paragraph synthesis of their worldview and what makes their voice unique.",
    )

    def to_prompt_str(self) -> str:
        """Render the profile as a structured prompt block for generation."""
        banned = ", ".join(self.banned_phrases) if self.banned_phrases else "none identified"
        signature = ", ".join(self.signature_phrases) if self.signature_phrases else "none identified"
        themes = "\n".join(f"  - {t}" for t in self.recurring_themes) if self.recurring_themes else "  - (none)"
        return (
            f"TONE: {self.tone}\n"
            f"VOCABULARY STYLE: {self.vocabulary_style}\n"
            f"SENTENCE STRUCTURE: {self.sentence_structure}\n"
            f"RECURRING THEMES:\n{themes}\n"
            f"BANNED PHRASES (never use): {banned}\n"
            f"SIGNATURE PHRASES (use sparingly): {signature}\n"
            f"VOICE SUMMARY:\n{self.pov_summary}"
        )


# ─── Output models ────────────────────────────────────────────────────────────


class GeneratedContent(BaseModel):
    """Content generated for a single platform."""
    platform: str
    content: str
    word_count: int = 0
    self_corrected: bool = Field(
        default=False,
        description="Whether the internal audit/rewrite pass changed the draft.",
    )

    def model_post_init(self, __context) -> None:  # pydantic v2 hook
        if self.word_count == 0 and self.content:
            object.__setattr__(self, "word_count", len(self.content.split()))


class ContentBundle(BaseModel):
    """All platform outputs for a single topic run."""
    topic: str
    voice_profile: VoiceProfile
    results: dict[str, GeneratedContent] = Field(default_factory=dict)
    errors: dict[str, str] = Field(default_factory=dict)

    @property
    def successful_platforms(self) -> list[str]:
        return list(self.results.keys())

    @property
    def failed_platforms(self) -> list[str]:
        return list(self.errors.keys())

    def print_summary(self) -> None:
        """Human-readable CLI output."""
        print(f"\n{'='*60}")
        print(f"TOPIC: {self.topic}")
        print(f"{'='*60}")
        for platform, content in self.results.items():
            print(f"\n{'─'*40}")
            print(f"=== {platform.upper()} ===")
            print(f"{'─'*40}")
            print(content.content)
        if self.errors:
            print(f"\n⚠️  Errors: {self.errors}")
