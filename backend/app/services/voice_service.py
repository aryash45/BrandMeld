"""
services/voice_service.py — Voice Authenticity Scoring.

Scores a generated draft against the user's brand voice profile across
4 dimensions: tone, vocabulary, structure, authenticity.
Uses Gemini with structured JSON output. Target latency: <2 seconds.
"""
from __future__ import annotations
import logging
from app.config import get_settings
from app.models.brand import AuthenticityScore

logger = logging.getLogger(__name__)


_SCORING_SYSTEM = """You are a personal brand voice analyst.
Score the draft against the voice profile on 4 dimensions (0-100 each):
- tone_match: Does the emotional register match? (e.g., casual vs formal, bold vs hedging)
- vocabulary_match: Are word choices / jargon consistent with the voice?
- structure_match: Does sentence length and format (lists, paragraphs) match?
- authenticity: Does it avoid buzzwords or phrasing the voice profile would hate?
Compute overall = average of the 4 scores.
Return a single JSON object only. No markdown, no commentary.
Also provide 1-2 concrete hints to improve the lowest dimension."""

_SCORING_SCHEMA = """{
  "tone_match": 88,
  "vocabulary_match": 91,
  "structure_match": 85,
  "authenticity": 79,
  "overall": 86,
  "hints": ["Use shorter sentences — your voice prefers punchy, direct statements."]
}"""


async def score_draft(draft: str, voice_personality: str) -> AuthenticityScore:
    """
    Score draft against voice_personality.
    Returns AuthenticityScore with 4 dimension scores + hints.
    Falls back to a default 75 score if Gemini fails (non-blocking).
    """
    from google import genai
    from google.genai import types as genai_types

    settings = get_settings()
    if not settings.gemini_api_key:
        return _fallback_score()

    prompt = (
        f"[VOICE PROFILE]\n{voice_personality}\n\n"
        f"[DRAFT TO SCORE]\n{draft}\n\n"
        f"Example output format:\n{_SCORING_SCHEMA}"
    )

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        resp = await __import__("asyncio").to_thread(
            lambda: client.models.generate_content(
                model=settings.gemini_model_id,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=_SCORING_SYSTEM,
                    response_mime_type="application/json",
                    temperature=0.2,   # low temp for deterministic scoring
                ),
            )
        )
        import json
        raw = json.loads(resp.text or "{}")
        tone = int(raw.get("tone_match", 75))
        vocab = int(raw.get("vocabulary_match", 75))
        struct = int(raw.get("structure_match", 75))
        auth = int(raw.get("authenticity", 75))
        overall = int((tone + vocab + struct + auth) / 4)
        hints = raw.get("hints", [])
        if isinstance(hints, str):
            hints = [hints]

        return AuthenticityScore(
            tone_match=tone,
            vocabulary_match=vocab,
            structure_match=struct,
            authenticity=auth,
            overall=overall,
            confidence_band=5,
            hints=hints[:3],
        )
    except Exception as exc:
        logger.warning("Authenticity scoring failed (non-fatal): %s", exc)
        return _fallback_score()


def _fallback_score() -> AuthenticityScore:
    return AuthenticityScore(
        tone_match=75,
        vocabulary_match=75,
        structure_match=75,
        authenticity=75,
        overall=75,
        confidence_band=10,
        hints=["Voice scoring unavailable. Review draft manually."],
    )
