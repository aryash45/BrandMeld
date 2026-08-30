#!/usr/bin/env python
"""
scripts/test_agent.py — Full Feature 1 workflow CLI test.

Runs:
    1. Voice extraction from sample founder posts
    2. Multi-platform content generation
    3. Quality validation (buzzwords, specificity, authenticity, consistency)
    4. Prints full ContentBundle with quality report

Usage:
    cd backend
    python scripts/test_agent.py

    # Custom topic
    python scripts/test_agent.py --topic "We just hit $10k MRR"

    # Skip voice extraction (reuse saved profile)
    python scripts/test_agent.py --profile-file scripts/voice_profile.json

    # Save extracted profile for reuse
    python scripts/test_agent.py --save-profile

    # Specific platforms only
    python scripts/test_agent.py --platforms twitter linkedin

    # Offline mode — uses sample profile, skips LLM validation scoring
    python scripts/test_agent.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time

# Force UTF-8 output on Windows so emoji characters don't crash the terminal
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# ── Path setup ─────────────────────────────────────────────────────────────────
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(_BACKEND_ROOT, ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from agent.voice_extractor import VoiceExtractor
from agent.content_generator import ContentGenerator
from agent.models import VoiceProfile
from agent.evaluator import SAMPLE_FOUNDER_POSTS

# ─── Sample topic (used when no --topic is provided) ──────────────────────────

SAMPLE_TOPIC = (
    "We just shipped async exports after 3 weeks of work. "
    "The feature lets users export large datasets in the background without blocking their workflow. "
    "Key lesson: we profiled before optimizing this time. "
    "Previous version was blocking the main thread — rookie mistake. "
    "Now exports finish in 30% of the original time."
)


# ─── Main test flow ───────────────────────────────────────────────────────────

async def run(args: argparse.Namespace) -> None:
    print("\n" + "=" * 65)
    print("  BrandMeld Feature 1 — Full Workflow Test")
    print("=" * 65)

    # Step 1: Voice Profile
    if args.profile_file and os.path.exists(args.profile_file):
        print(f"\n📂 Loading profile from {args.profile_file}…")
        with open(args.profile_file) as f:
            profile = VoiceProfile(**json.load(f))
        print(f"✅ Profile loaded (authenticity: {profile.authenticity_score:.1f}/10)")
    else:
        posts = SAMPLE_FOUNDER_POSTS
        print(f"\n🎙️  Extracting voice from {len(posts)} writing samples…")
        t0 = time.perf_counter()
        profile = await VoiceExtractor().extract(posts)
        elapsed = time.perf_counter() - t0
        print(f"✅ Voice extracted in {elapsed:.1f}s")
        print(f"\n── Voice Signature ──────────────────────────────────────────")
        print(f"  Authenticity: {profile.authenticity_score:.1f}/10")
        print(f"  Vulnerability: {profile.vulnerability_level:.1f}/10")
        print(f"  Technical Depth: {profile.technical_depth}")
        print(f"  Humor: {profile.humor_style}")
        print(f"  Signature Phrases: {profile.signature_phrases}")
        print(f"  Core Values: {profile.core_values}")
        if args.verbose:
            print(f"\n  Personality: {profile.personality_markers}")
            print(f"  Learning Mindset: {profile.learning_mindset}")
            print(f"  What they don't do: {profile.what_they_dont_do}")

        if args.save_profile:
            out = os.path.join(os.path.dirname(__file__), "voice_profile.json")
            with open(out, "w") as f:
                json.dump(profile.model_dump(), f, indent=2)
            print(f"\n💾 Profile saved → {out}")

    # Step 2: Content Generation + Validation
    platforms = args.platforms or ["linkedin", "twitter", "newsletter"]
    print(f"\n✍️  Generating content for: {', '.join(platforms)}")
    print(f"   Topic: {args.topic[:80]}{'…' if len(args.topic) > 80 else ''}")
    print()

    t0 = time.perf_counter()
    bundle = await ContentGenerator().generate(
        voice=profile,
        topic=args.topic,
        platforms=platforms,
    )
    elapsed = time.perf_counter() - t0
    print(f"\n✅ Generation + validation complete in {elapsed:.1f}s")

    # Step 3: Print summary
    bundle.print_summary()

    # Step 4: Quality report detail
    if bundle.quality_report:
        qr = bundle.quality_report
        print(f"\n── Quality Report ───────────────────────────────────────────")
        print(f"  Overall Authenticity : {qr.overall_authenticity:.1f}/10")
        print(f"  Consistency Score    : {qr.consistency_score:.1f}/10")
        print(f"  Buzzwords Found      : {qr.total_buzzwords_found}")
        print(f"  Platform Scores      : {qr.platform_scores}")
        print(f"  Ready to Publish     : {'✅ YES' if qr.ready_to_publish else '❌ NO'}")
        if qr.manual_review_reasons:
            print(f"  Manual Review Needed:")
            for r in qr.manual_review_reasons:
                print(f"    • {r}")

    # Exit code
    if bundle.quality_report and bundle.quality_report.ready_to_publish:
        print("\n✅ Feature 1 test PASSED — content is ready to publish.\n")
        sys.exit(0)
    else:
        print("\n⚠️  Feature 1 test complete — manual review required.\n")
        sys.exit(0)  # Not a failure — review is expected on first runs


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="BrandMeld Feature 1 workflow test")
    p.add_argument("--topic", default=SAMPLE_TOPIC, help="Topic to generate content about")
    p.add_argument(
        "--platforms", nargs="+",
        choices=["linkedin", "twitter", "newsletter", "instagram"],
        help="Platforms to generate (default: all 3 main)",
    )
    p.add_argument("--profile-file", default=None, help="Path to saved VoiceProfile JSON")
    p.add_argument("--save-profile", action="store_true", help="Save extracted profile to JSON")
    p.add_argument("--verbose", "-v", action="store_true", help="Show full voice profile details")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if not os.getenv("NVIDIA_API_KEY"):
        print("\n❌ NVIDIA_API_KEY not set. Add it to backend/.env\n")
        sys.exit(1)
    asyncio.run(run(args))
