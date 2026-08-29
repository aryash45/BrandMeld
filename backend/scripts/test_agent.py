#!/usr/bin/env python
"""
scripts/test_agent.py — CLI smoke test for BrandMeld Feature 1.

Tests the full pipeline:
    1. Voice extraction from sample founder posts
    2. Multi-platform content generation

NO database, NO UI, NO REST API needed. Just NVIDIA_API_KEY in .env.

Usage:
    cd backend
    python scripts/test_agent.py

    # With a custom topic:
    python scripts/test_agent.py --topic "We just shipped async exports"

    # Only specific platforms:
    python scripts/test_agent.py --platforms twitter linkedin

    # Use a saved profile JSON (skip extraction):
    python scripts/test_agent.py --profile-file my_profile.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time

# ── Path setup: ensure backend/ root is on sys.path ───────────────────────────
# This lets us run from anywhere: `python scripts/test_agent.py`
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

# ── Load .env before any other imports ────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(os.path.join(_BACKEND_ROOT, ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
# Quiet the httpx noise during testing
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from agent.voice_extractor import extract_voice
from agent.content_generator import generate_content
from agent.models import VoiceProfile


# ─── Sample founder posts (used when no --profile-file is passed) ─────────────
# Replace these with actual founder writing samples for a real extraction.

SAMPLE_FOUNDER_POSTS = [
    """
    Most "growth hacks" are just noise.
    Here's what actually moved the needle for us in Q3:
    - Stopped posting daily, started posting weekly with depth
    - Cut the newsletter from 5 sections to 2
    - Replied to every single comment for 30 days straight
    That's it. Consistency + quality. Nothing revolutionary.
    """,
    """
    Shipped async exports today after 3 weeks of painful iteration.
    The first version was completely wrong — we were blocking the main thread.
    Lesson: profile first, optimize second. Always.
    We burned a week on premature optimization that didn't matter.
    """,
    """
    Hot take: most SaaS onboarding is designed to impress investors, not users.
    Long feature tours, animated explainers, confetti on signup —
    all of it is security theater for the demo.
    Real onboarding = get them to their first value moment, fast.
    Ours took 11 minutes on average. We got it to 4. Conversion went up 34%.
    """,
    """
    I've done 3 startups. Every single time the bottleneck wasn't product, wasn't fundraising.
    It was sales. Specifically: I hated doing it and avoided it for too long.
    If you're building B2B and you're not doing 10 customer calls a week, you're hiding.
    The product is never done enough. Just call them.
    """,
    """
    Small team. No marketing budget. How we got our first 500 users:
    1. Posted honestly about building in public (not "excited to share" posts — real ones)
    2. Answered every relevant question on indie hackers + HN
    3. DM'd 200 people who complained about our category on Twitter
    DMs had a 60% reply rate. Of those, 40% booked a demo.
    Cold outreach works when it's actually relevant.
    """,
]

SAMPLE_TOPIC = (
    "We just shipped async exports after 3 weeks of work. "
    "The feature lets users export large datasets in the background without blocking their workflow. "
    "Key lesson: we almost shipped a broken version because we optimized too early."
)


# ─── Main test flow ───────────────────────────────────────────────────────────


async def run_test(
    topic: str,
    platforms: list[str],
    profile_file: str | None,
    save_profile: bool,
) -> None:
    """Full end-to-end test of Feature 1."""

    print("\n" + "=" * 60)
    print("  BrandMeld Agent — Feature 1 Smoke Test")
    print("=" * 60)

    # Step 1: Get VoiceProfile
    if profile_file:
        print(f"\n📂 Loading voice profile from: {profile_file}")
        with open(profile_file) as f:
            data = json.load(f)
        profile = VoiceProfile(**data)
        print("✅ Voice profile loaded.")
    else:
        print(f"\n🎙️  Extracting voice from {len(SAMPLE_FOUNDER_POSTS)} writing samples…")
        t0 = time.perf_counter()
        profile = await extract_voice(SAMPLE_FOUNDER_POSTS)
        elapsed = time.perf_counter() - t0
        print(f"✅ Voice extracted in {elapsed:.1f}s")
        print("\n── Voice Signature ──────────────────────────────────────")
        print(json.dumps(profile.model_dump(), indent=2))

        if save_profile:
            out_path = os.path.join(_BACKEND_ROOT, "scripts", "voice_profile.json")
            with open(out_path, "w") as f:
                json.dump(profile.model_dump(), f, indent=2)
            print(f"\n💾 Profile saved to: {out_path}")

    # Step 2: Generate content
    print(f"\n✍️  Generating content for platforms: {', '.join(platforms)}")
    print(f"   Topic: {topic[:80]}{'…' if len(topic) > 80 else ''}")

    t0 = time.perf_counter()
    bundle = await generate_content(voice=profile, topic=topic, platforms=platforms)
    elapsed = time.perf_counter() - t0

    print(f"✅ Generation complete in {elapsed:.1f}s")

    # Step 3: Print results
    bundle.print_summary()

    if bundle.errors:
        print(f"\n⚠️  Failed platforms: {bundle.errors}")
        sys.exit(1)

    print(f"\n✅ Feature 1 smoke test passed — {len(bundle.results)} platform(s) generated.\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="BrandMeld Feature 1 — Voice extraction + content generation CLI test"
    )
    parser.add_argument(
        "--topic",
        default=SAMPLE_TOPIC,
        help="Topic/update to generate content about (default: built-in sample)",
    )
    parser.add_argument(
        "--platforms",
        nargs="+",
        default=["twitter", "linkedin", "newsletter"],
        choices=["twitter", "linkedin", "newsletter", "instagram"],
        help="Platforms to generate for (default: twitter linkedin newsletter)",
    )
    parser.add_argument(
        "--profile-file",
        default=None,
        metavar="PATH",
        help="Path to a saved VoiceProfile JSON (skips extraction step)",
    )
    parser.add_argument(
        "--save-profile",
        action="store_true",
        help="Save the extracted VoiceProfile to scripts/voice_profile.json",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Check for API key early so the error is clear
    if not os.getenv("NVIDIA_API_KEY"):
        print("\n❌ NVIDIA_API_KEY not set.")
        print("   Add it to backend/.env or export it in your shell:")
        print("   export NVIDIA_API_KEY=nvapi-...\n")
        sys.exit(1)

    asyncio.run(
        run_test(
            topic=args.topic,
            platforms=args.platforms,
            profile_file=args.profile_file,
            save_profile=args.save_profile,
        )
    )
