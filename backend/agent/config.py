"""
agent/config.py — Centralized thresholds, blacklists, and tuning constants.

All quality gate logic reads from here. Change a threshold here → affects
the entire pipeline. No magic numbers anywhere else.
"""
from __future__ import annotations

# ─── Authenticity Scoring Thresholds ─────────────────────────────────────────

AUTHENTICITY_PASS_THRESHOLD = 7.0       # ≥ 7 → PASS
AUTHENTICITY_MARGINAL_LOW = 5.0         # 5–6.9 → MARGINAL (flag for manual review)
AUTHENTICITY_FAIL_THRESHOLD = 5.0       # < 5 → FAIL (auto-regenerate)

# ─── Consistency ─────────────────────────────────────────────────────────────

CONSISTENCY_PASS_THRESHOLD = 7.0        # ≥ 7 → PASS
CONSISTENCY_WARN_THRESHOLD = 5.0        # 5–6.9 → WARNING

# ─── Specificity ─────────────────────────────────────────────────────────────

MIN_CONCRETE_DETAILS_PER_100_WORDS = 2  # concrete numbers/dates/examples per 100 words
MIN_SIGNATURE_PHRASES_REQUIRED = 2      # at least 2 per generated version

# ─── Regeneration ────────────────────────────────────────────────────────────

MAX_REGENERATION_ATTEMPTS = 2           # before giving up and flagging for manual review

# ─── Buzzword Blacklist ───────────────────────────────────────────────────────
# Any word/phrase in this list appearing in generated content → automatic flag.

BUZZWORD_BLACKLIST: list[str] = [
    # Generic innovation theater
    "innovative", "innovation", "innovate",
    "paradigm shift", "paradigm-shifting",
    "empower", "empowering", "empowers",
    "revolutionize", "revolutionary", "revolution",
    "disruptive", "disrupt", "disruption",
    "transformative", "transform",
    "groundbreaking", "game-changer", "game-changing",
    # Corporate fluff
    "leverage", "leveraging", "leveraged",
    "ecosystem", "synergy", "synergistic",
    "cutting-edge", "best-in-class", "world-class",
    "seamless", "seamlessly",
    "unlock", "unlocking",
    "scale", "scaling",  # context-dependent but flagged for review
    "growth hacking",
    # Excitement theater
    "excited to announce", "excited to share",
    "thrilled to announce", "thrilled to share",
    "pleased to announce", "pleased to share",
    "delighted to announce", "delighted to share",
    "proud to announce",
    # Vague power words
    "thought leader", "thought leadership",
    "value-add", "value add",
    "move the needle",
    "at the end of the day",
    "circle back",
]

# ─── Manual Review Triggers ───────────────────────────────────────────────────

MANUAL_REVIEW_IF_AUTH_BETWEEN = (5.0, 6.9)   # marginal zone
MANUAL_REVIEW_IF_CONSISTENCY_BELOW = 7.0
MANUAL_REVIEW_IF_CONFIDENCE_BELOW = 0.8

# ─── Platform Format Rules ───────────────────────────────────────────────────

PLATFORM_FORMAT: dict[str, dict] = {
    "linkedin": {
        "min_chars": 800,
        "max_chars": 1200,
        "description": "Professional narrative with narrative arc",
    },
    "twitter": {
        "min_tweets": 3,
        "max_tweets": 8,
        "max_chars_per_tweet": 280,
        "description": "Numbered thread, punchy and engagement-focused",
    },
    "newsletter": {
        "min_words": 400,
        "max_words": 600,
        "description": "Long-form personal reflection with teaching value",
    },
    "instagram": {
        "min_words": 80,
        "max_words": 150,
        "description": "Conversational caption with hashtags",
    },
}
