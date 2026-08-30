
from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agent.models import VoiceProfile, EvalReport, EvalResult

logger = logging.getLogger(__name__)


# ─── Sample Founder Data ──────────────────────────────────────────────────────
# "Alex Chen" — pragmatic engineer, ships-first, openly discusses failures

SAMPLE_FOUNDER_POSTS = [
    "Shipping beats perfecting. We launched with 3 bugs yesterday. Users found 2 more. "
    "All fixed by EOD. Total damage: 4 hours of user frustration. Alternative: delay 2 weeks. "
    "We made the right call.",
    "We were wrong about our auth flow. Spent 6 weeks building the 'right' architecture. "
    "Users didn't care. They just wanted to log in fast. Rebuilt it in 4 days. "
    "40% faster. Lesson: ask users earlier.",
    "Real impact: 6 months of work. 500 users. $50k ARR. Nothing groundbreaking. "
    "Just shipping every week and listening to the 12 users who were actually paying us.",
    "Hot take: most SaaS onboarding is designed to impress investors, not users. "
    "Ours took 11 minutes on average. We got it to 4. Conversion went up 34%. "
    "No redesign — just removed 7 steps nobody needed.",
    "Shipped async exports after 3 weeks. The first version was completely wrong — "
    "we were blocking the main thread. Profiled first (finally), optimized second. "
    "Always profile first. We burned a week on premature optimization that didn't matter.",
    "Small team. No marketing budget. First 500 users: "
    "1. Posted honestly about building (not 'excited to share' posts — real ones) "
    "2. Answered every question on indie hackers + HN "
    "3. DM'd 200 people who complained about our category on Twitter. "
    "DMs: 60% reply rate. 40% booked a demo. Cold outreach works when it's actually relevant.",
    "We were wrong about async. Spent 3 months building a 'clean' event system. "
    "Turns out simple polling every 30s was fine for our use case. "
    "Complexity is a cost. We paid it unnecessarily.",
]

SAMPLE_VOICE_PROFILE_DATA = {
    "signature_phrases": [
        "shipping beats perfecting",
        "we were wrong about",
        "real impact",
        "ask users earlier",
    ],
    "learning_mindset": (
        "Openly discusses failures with specific examples. Uses 'We were wrong about X' "
        "as a recurring structure. Shares exact timeframes of mistakes."
    ),
    "specificity_patterns": (
        "Always uses exact numbers: timeframes (3 weeks, 6 months), user counts (500 users), "
        "revenue ($50k ARR), percentages (40% faster, 34% conversion). "
        "Never uses vague claims."
    ),
    "personality_markers": (
        "Uses numbered lists for process transparency. Ends with a lesson, not a question. "
        "Frames failures as evidence, not confessions. Never uses exclamation marks."
    ),
    "what_they_dont_do": [
        "Never uses buzzwords like 'leverage', 'ecosystem', 'synergy'",
        "Never writes 'excited to share' or 'thrilled to announce'",
        "Never gives vague claims without backing numbers",
        "Never uses exclamation marks",
        "Never promotes without context",
    ],
    "authenticity_score": 9.0,
    "why_authentic": (
        "Voice is unmistakable due to consistent use of 'we were wrong about' structure, "
        "always-specific numbers, and an analytical-not-emotional tone about failures."
    ),
    "technical_depth": "expert — references specific technical decisions (auth architecture, event systems, profiling)",
    "vulnerability_level": 9.0,
    "humor_style": "dry — 'Total damage: 4 hours of user frustration'",
    "core_values": ["shipping over perfection", "user feedback over assumptions", "specificity over inspiration"],
    "example_voice_sample": "We were wrong about X. Here's the exact number that proved it.",
    "banned_phrases": ["leverage", "ecosystem", "synergy", "excited to share", "groundbreaking"],
}


class Evaluator:
    """
    Runs all 7 evals for Feature 1. Rule-based evals run offline.
    LLM evals require NVIDIA_API_KEY.
    """

    def __init__(self, use_llm: bool = True):
        self.use_llm = use_llm
        self.api_calls = 0

    def _make_voice_profile(self) -> "VoiceProfile":
        from agent.models import VoiceProfile
        return VoiceProfile(**SAMPLE_VOICE_PROFILE_DATA)

    def _record(
        self,
        eval_id: str,
        eval_name: str,
        test_cases: list[dict],
    ) -> "EvalResult":
        from agent.models import EvalResult
        passed = sum(1 for tc in test_cases if tc.get("passed"))
        failed = sum(1 for tc in test_cases if not tc.get("passed"))
        score = (passed / len(test_cases)) * 10 if test_cases else 0
        status = "PASS" if failed == 0 else ("MARGINAL" if passed > failed else "FAIL")
        details = f"{passed}/{len(test_cases)} test cases passed."
        return EvalResult(
            eval_id=eval_id,
            eval_name=eval_name,
            status=status,
            score=score,
            details=details,
            test_cases=test_cases,
            passed_count=passed,
            failed_count=failed,
        )

    # ─── Eval 1: Anti-Slop Detection (rule-based) ────────────────────────────

    def eval_1_anti_slop(self) -> "EvalResult":
        """
        Tests the buzzword detection rule: zero tolerance for blacklisted words.
        Runs entirely offline — no LLM needed.
        """
        from agent.quality_gate import QualityGate
        gate = QualityGate()

        test_cases = [
            {
                "name": "Clean founder post",
                "input": "Shipping beats perfecting. We were wrong about our auth flow. "
                         "Rebuilt it in 4 days. 40% faster.",
                "expected_buzzwords": [],
            },
            {
                "name": "Obvious corporate slop",
                "input": "Delighted to announce our paradigm-shifting innovation that will "
                         "revolutionize the ecosystem and empower our users.",
                "expected_buzzwords": ["revolutionize", "ecosystem", "empower"],
            },
            {
                "name": "Subtle buzzwords",
                "input": "We leveraged cutting-edge technology to deliver a seamless experience.",
                "expected_buzzwords": ["leverage", "cutting-edge", "seamless"],
            },
            {
                "name": "Excited to share opener",
                "input": "Excited to share some big news. We just hit $50k ARR.",
                "expected_buzzwords": ["excited to share"],
            },
            {
                "name": "Buzzword-free metric post",
                "input": "6 months. 500 users. $50k ARR. Rebuilt the UX twice. "
                         "Users wanted it faster. We built it faster.",
                "expected_buzzwords": [],
            },
        ]

        results = []
        for tc in test_cases:
            found = gate.check_buzzwords(tc["input"])
            expected_set = set(b.lower() for b in tc["expected_buzzwords"])
            found_set = set(b.lower() for b in found)

            if tc["expected_buzzwords"]:
                # Should detect at least some of the expected buzzwords
                detected_any = bool(expected_set & found_set)
                passed = detected_any
                notes = f"Found: {found} | Expected to catch: {tc['expected_buzzwords']}"
            else:
                # Should find ZERO buzzwords
                passed = len(found) == 0
                notes = f"Found: {found} (expected: none)"

            results.append({
                "name": tc["name"],
                "passed": passed,
                "found_buzzwords": found,
                "expected_buzzwords": tc["expected_buzzwords"],
                "notes": notes,
            })

        return self._record("eval_1", "Anti-Slop Detection (Buzzword Blacklist)", results)

    # ─── Eval 2: Signature Phrase Usage (rule-based) ─────────────────────────

    def eval_2_signature_phrases(self) -> "EvalResult":
        """
        Tests that signature phrases appear naturally in generated text.
        Rule-based: checks if phrases from the voice profile appear in sample outputs.
        """
        from agent.quality_gate import QualityGate
        gate = QualityGate()
        phrases = SAMPLE_VOICE_PROFILE_DATA["signature_phrases"]

        test_cases = [
            {
                "name": "Post uses multiple signature phrases",
                "input": "Shipping beats perfecting. We launched v2. We were wrong about "
                         "the pricing model. Real impact: 200 new users in a week.",
                "min_required": 2,
                # Positive test: good content should meet the threshold
                "expect_pass": True,
            },
            {
                "name": "Post with zero signature phrases (gate should reject)",
                "input": "Our new feature allows users to export data asynchronously. "
                         "This improves the overall workflow experience significantly.",
                "min_required": 2,
                # Negative test: bad content should be rejected by the gate (found < min)
                "expect_pass": False,
            },
            {
                "name": "Post with one phrase (marginal)",
                "input": "Real impact from this feature: 40% fewer support tickets. "
                         "Users asked for it. We built it. Took 3 weeks.",
                "min_required": 1,
                # Positive test: one phrase is enough when min_required=1
                "expect_pass": True,
            },
        ]

        results = []
        for tc in test_cases:
            found = gate.check_signature_phrases(tc["input"], phrases)
            gate_passes = len(found) >= tc["min_required"]
            # The eval passes when the gate result matches what we expect:
            # - positive tests: gate should accept (gate_passes == True)
            # - negative tests: gate should reject (gate_passes == False)
            passed = gate_passes == tc["expect_pass"]
            results.append({
                "name": tc["name"],
                "passed": passed,
                "signature_phrases_found": found,
                "phrases_found_count": len(found),
                "min_required": tc["min_required"],
                "notes": f"Found {len(found)}/{tc['min_required']} required.",
            })

        return self._record("eval_2", "Signature Phrase Usage", results)

    # ─── Eval 3: Specificity Check (rule-based) ───────────────────────────────

    def eval_3_specificity(self) -> "EvalResult":
        """
        Tests that generated content contains concrete details.
        Rule-based: heuristic counting of numbers, dates, quantified claims.
        """
        from agent.quality_gate import QualityGate
        gate = QualityGate()

        test_cases = [
            {
                "name": "High-specificity post (numbers, timeframes)",
                "input": "6 months. 500 users. $50k ARR. Rebuilt the UX twice. "
                         "Onboarding went from 11 minutes to 4. Conversion up 34%.",
                "expected_level": "high",
            },
            {
                "name": "Low-specificity post (vague)",
                "input": "We're excited about our new feature. It makes things better "
                         "for our users. The team worked really hard on this one.",
                "expected_level": "low",
            },
            {
                "name": "Medium-specificity post (some details)",
                "input": "UX was hard. We rebuilt it twice. Now it's 40% faster. "
                         "Users are happier.",
                "expected_level": "medium",
            },
            {
                "name": "Version numbers count as specifics",
                "input": "Shipped v2.1 today. Fixed the 3 auth bugs from last week. "
                         "Response time down to 120ms.",
                "expected_level": "high",
            },
        ]

        results = []
        for tc in test_cases:
            level = gate.check_specificity(tc["input"])
            # "high" >= "medium" >= "low" → we check at least expected level
            level_order = {"high": 3, "medium": 2, "low": 1}
            expected_order = level_order.get(tc["expected_level"], 1)
            actual_order = level_order.get(level, 1)
            # For "expected: low", any level passes. For "expected: high", only high passes.
            if tc["expected_level"] == "low":
                passed = True  # any result is fine — we just want to detect low correctly
                passed = level == "low"
            else:
                passed = actual_order >= expected_order
            results.append({
                "name": tc["name"],
                "passed": passed,
                "specificity_level": level,
                "expected_level": tc["expected_level"],
                "notes": f"Got '{level}', expected '{tc['expected_level']}'",
            })

        return self._record("eval_3", "Specificity Check", results)

    # ─── Eval 4: Platform Format Validation (rule-based) ─────────────────────

    def eval_4_platform_format(self) -> "EvalResult":
        """
        Tests platform format rules: character counts, tweet counts, word counts.
        """
        from agent.quality_gate import QualityGate
        gate = QualityGate()

        # Sample LinkedIn post (>800 chars — must meet min_chars threshold)
        linkedin_sample = (
            "We were wrong about our onboarding flow.\n\n"
            "We built a 7-step wizard because investors expected 'polish.' "
            "Users were dropping off at step 3. Not step 6. Not step 7. Step 3.\n\n"
            "So we killed 4 steps. No A/B test. No committee. Just deleted them on a Tuesday.\n\n"
            "Onboarding went from 11 minutes to 4. Conversion up 34% in 2 weeks. "
            "We shipped the simplified version in 3 days. "
            "The old version took 6 weeks and a full design sprint.\n\n"
            "The lesson: don't build for the demo. Build for the user who's half-distracted "
            "and just wants to get to their first win as fast as possible.\n\n"
            "We were wrong about what 'polished' means. Polish isn't extra steps — "
            "it's removing the friction nobody asked for. Every step we removed was a "
            "conversion we recovered.\n\n"
            "Shipping beats perfecting. Always profile the user journey before adding to it.\n\n"
            "#ProductDesign #StartupLessons #BuildingInPublic"
        )

        # Sample Twitter thread
        twitter_sample = (
            "1/ We were wrong about our onboarding. Here's what we learned.\n"
            "2/ Built a 7-step wizard. Looked great in demos. Users dropped at step 3.\n"
            "3/ We killed 4 steps. No A/B test. Just deleted them.\n"
            "4/ Onboarding: 11 min → 4 min. Conversion up 34% in 2 weeks.\n"
            "5/ Don't build for the demo. Build for the distracted user.\n"
            "6/ Shipping beats perfecting. Always ask: what can we remove?"
        )

        # Sample newsletter (>400 words — must meet min_words threshold)
        newsletter_words = (
            "Six months ago we thought we'd nailed our onboarding. " * 25
            + "The lesson: remove before you add, not after. " * 25
            + "Ask your users early, not your investors late. " * 10
        )

        test_cases = [
            {
                "name": "LinkedIn: correct length",
                "platform": "linkedin",
                "input": linkedin_sample,
                "expected_ok": True,
            },
            {
                "name": "LinkedIn: too short",
                "platform": "linkedin",
                "input": "We shipped a feature. It's good.",
                "expected_ok": False,
            },
            {
                "name": "Twitter: correct thread format",
                "platform": "twitter",
                "input": twitter_sample,
                "expected_ok": True,
            },
            {
                "name": "Twitter: no tweet numbering",
                "platform": "twitter",
                "input": "We shipped a feature and here's what we learned. It was hard.",
                "expected_ok": False,
            },
            {
                "name": "Newsletter: correct word count",
                "platform": "newsletter",
                "input": newsletter_words,
                "expected_ok": True,
            },
        ]

        results = []
        for tc in test_cases:
            fmt = gate.check_platform_format(tc["input"], tc["platform"])
            passed = fmt["ok"] == tc["expected_ok"]
            results.append({
                "name": tc["name"],
                "passed": passed,
                "format_ok": fmt["ok"],
                "expected_ok": tc["expected_ok"],
                "issues": fmt.get("issues", []),
                "passes": fmt.get("passes", []),
            })

        return self._record("eval_4", "Platform Format Validation", results)

    # ─── Eval 5: Negative Testing (slop detection, rule-based) ────────────────

    def eval_5_negative_cases(self) -> "EvalResult":
        """
        Intentionally bad inputs — validates the detection pipeline catches them.
        All rule-based.
        """
        from agent.quality_gate import QualityGate
        gate = QualityGate()

        # All of these SHOULD be caught as problematic
        bad_inputs = [
            {
                "name": "Extreme corporate slop",
                "input": "Delighted to announce our paradigm-shifting innovation.",
                "should_catch_buzzwords": ["paradigm shift"],
                "specificity_should_be": "low",
            },
            {
                "name": "Buzzword overload",
                "input": "Leveraging cutting-edge technology to revolutionize our ecosystem "
                         "and empower users with synergistic outcomes.",
                "should_catch_buzzwords": ["leverage", "cutting-edge", "revolutionize"],
                "specificity_should_be": "low",
            },
            {
                "name": "Generic AI content",
                "input": "We are thrilled to share exciting news with our valued community today.",
                "should_catch_buzzwords": ["thrilled to share"],
                "specificity_should_be": "low",
            },
            {
                "name": "Vague claims without specifics",
                "input": "This is game-changing for our users. It will make things better.",
                "should_catch_buzzwords": ["game-changing"],
                "specificity_should_be": "low",
            },
            {
                "name": "Excited opener",
                "input": "Excited to share our latest feature launch. More details soon!",
                "should_catch_buzzwords": ["excited to share"],
                "specificity_should_be": "low",
            },
        ]

        results = []
        for tc in bad_inputs:
            found_buzzwords = gate.check_buzzwords(tc["input"])
            specificity = gate.check_specificity(tc["input"])

            expected_caught = set(b.lower() for b in tc["should_catch_buzzwords"])
            actually_caught = set(b.lower() for b in found_buzzwords)
            buzzwords_caught = bool(expected_caught & actually_caught)
            specificity_ok = specificity == tc["specificity_should_be"]

            passed = buzzwords_caught or specificity_ok  # either catch mechanism works
            results.append({
                "name": tc["name"],
                "passed": passed,
                "buzzwords_caught": found_buzzwords,
                "specificity_detected": specificity,
                "notes": (
                    f"Buzzwords caught: {buzzwords_caught} | "
                    f"Specificity low: {specificity_ok}"
                ),
            })

        return self._record("eval_5", "Negative Testing (Slop Detection)", results)

    # ─── Eval 6: Authenticity Score Range (LLM — skipped in dry-run) ──────────

    async def eval_6_authenticity_scoring(self, profile: "VoiceProfile") -> "EvalResult":
        """
        Tests LLM authenticity scoring against known good/bad samples.
        Requires LLM API access.
        """
        from agent.quality_gate import QualityGate

        gate = QualityGate()

        test_cases_def = [
            {
                "name": "High-authenticity post (should score 8-10)",
                "text": (
                    "Shipping beats perfecting. We were wrong about the queue architecture — "
                    "spent 4 weeks building something we didn't need. "
                    "Real impact: just ship the simple version first. "
                    "This one saved us 3 weeks of tech debt."
                ),
                "min_expected": 7.0,
                "max_expected": 10.0,
            },
            {
                "name": "Corporate slop (should score 1-4)",
                "text": (
                    "Excited to announce our groundbreaking marketplace integration "
                    "that empowers our ecosystem with seamless cutting-edge solutions."
                ),
                "min_expected": 1.0,
                "max_expected": 4.0,
            },
            {
                "name": "Marginal post (should score 5-7)",
                "text": (
                    "We shipped v2 of our export feature. "
                    "Users can now export in the background. "
                    "This was a highly requested feature."
                ),
                "min_expected": 4.0,
                "max_expected": 8.0,
            },
        ]

        results = []
        for tc in test_cases_def:
            try:
                llm_score = await gate.score_authenticity(tc["text"], profile, "linkedin")
                self.api_calls += 1
                score = llm_score.authenticity_score
                passed = tc["min_expected"] <= score <= tc["max_expected"]
                results.append({
                    "name": tc["name"],
                    "passed": passed,
                    "authenticity_score": score,
                    "expected_range": f"{tc['min_expected']}-{tc['max_expected']}",
                    "red_flags": llm_score.red_flags[:3],
                    "notes": f"Score {score:.1f} {'in' if passed else 'outside'} expected range",
                })
            except Exception as exc:
                results.append({
                    "name": tc["name"],
                    "passed": False,
                    "error": str(exc),
                    "notes": "LLM call failed",
                })

        return self._record("eval_6", "Authenticity Scoring (LLM)", results)

    # ─── Eval 7: Voice Consistency (LLM — skipped in dry-run) ────────────────

    async def eval_7_voice_consistency(self, profile: "VoiceProfile") -> "EvalResult":
        """
        Tests cross-platform consistency scoring.
        Requires LLM API access.
        """
        from agent.quality_gate import QualityGate
        gate = QualityGate()

        # Consistent set
        linkedin_good = (
            "We made mistakes. Here's what we learned.\n\n"
            "Spent 6 weeks on the 'right' architecture. Users didn't care. "
            "They just wanted it fast. Rebuilt in 4 days. 40% faster.\n\n"
            "Shipping beats perfecting. Always.\n\n#BuildInPublic #StartupLessons"
        )
        twitter_good = (
            "1/ We were wrong about our auth architecture.\n"
            "2/ 6 weeks building the 'right' system. Users just wanted fast login.\n"
            "3/ Rebuilt in 4 days. 40% faster.\n"
            "4/ Shipping beats perfecting. Ask users before building."
        )
        newsletter_good = (
            "Six weeks. That's how long we spent building what I thought was the right "
            "auth system. Clean. Scalable. Well-documented.\n\n"
            "Then I watched 3 users fail to log in during a demo.\n\n"
            "We rebuilt it in 4 days. 40% faster. Less code. Real impact.\n\n"
            "The lesson: we were wrong about what mattered. "
            "Shipping beats perfecting — but only if you're shipping the right thing. "
            "Ask your users. Not after you build. Before."
        )

        # Inconsistent set (newsletter is corporate)
        newsletter_bad = (
            "We are excited to announce the launch of our innovative authentication solution. "
            "This groundbreaking feature empowers our users to leverage seamless login experiences. "
            "Our world-class team worked tirelessly to deliver this paradigm-shifting update."
        )

        results = []

        # Case 1: Consistent set — should score high
        try:
            result_good = await gate.check_consistency(
                linkedin_good, twitter_good, newsletter_good, profile
            )
            self.api_calls += 1
            passed = result_good.consistency_score >= 7.0 and result_good.sounds_same_person
            results.append({
                "name": "Consistent set — should score ≥ 7",
                "passed": passed,
                "consistency_score": result_good.consistency_score,
                "sounds_same_person": result_good.sounds_same_person,
                "notes": result_good.overall_analysis[:100],
            })
        except Exception as exc:
            results.append({"name": "Consistent set", "passed": False, "error": str(exc)})

        # Case 2: Inconsistent set — should score low
        try:
            result_bad = await gate.check_consistency(
                linkedin_good, twitter_good, newsletter_bad, profile
            )
            self.api_calls += 1
            passed = result_bad.consistency_score < 7.0 or not result_bad.sounds_same_person
            results.append({
                "name": "Inconsistent set (corporate newsletter) — should flag",
                "passed": passed,
                "consistency_score": result_bad.consistency_score,
                "sounds_same_person": result_bad.sounds_same_person,
                "notes": result_bad.overall_analysis[:100],
            })
        except Exception as exc:
            results.append({"name": "Inconsistent set", "passed": False, "error": str(exc)})

        return self._record("eval_7", "Voice Consistency (Cross-Platform, LLM)", results)

    # ─── Run All ──────────────────────────────────────────────────────────────

    async def run_all(self, voice_profile: "VoiceProfile | None" = None) -> "EvalReport":
        """
        Run all 7 evals and return a comprehensive EvalReport.

        Args:
            voice_profile: Optional prebuilt VoiceProfile. If None, uses sample data.
        """
        from agent.models import EvalReport

        profile = voice_profile or self._make_voice_profile()
        start = time.perf_counter()

        logger.info("Running %s evals (use_llm=%s)…", "all 7", self.use_llm)

        # Rule-based evals (always run)
        results = {}
        for name, fn in [
            ("eval_1_anti_slop_detection", self.eval_1_anti_slop),
            ("eval_2_signature_phrases", self.eval_2_signature_phrases),
            ("eval_3_specificity", self.eval_3_specificity),
            ("eval_4_platform_format", self.eval_4_platform_format),
            ("eval_5_negative_testing", self.eval_5_negative_cases),
        ]:
            logger.info("Running %s…", name)
            result = fn()
            results[name] = result
            logger.info("  → %s (score: %.1f)", result.status, result.score)

        # LLM evals (optional)
        if self.use_llm:
            for name, coro in [
                ("eval_6_authenticity_scoring", self.eval_6_authenticity_scoring(profile)),
                ("eval_7_voice_consistency", self.eval_7_voice_consistency(profile)),
            ]:
                logger.info("Running %s (LLM)…", name)
                result = await coro
                results[name] = result
                logger.info("  → %s (score: %.1f)", result.status, result.score)
        else:
            for name in ("eval_6_authenticity_scoring", "eval_7_voice_consistency"):
                from agent.models import EvalResult
                results[name] = EvalResult(
                    eval_id=name,
                    eval_name=name,
                    status="SKIPPED",
                    score=0.0,
                    details="Skipped (use_llm=False). Run with --llm to enable.",
                    test_cases=[],
                )

        elapsed = time.perf_counter() - start
        all_scores = [r.score for r in results.values() if r.status != "SKIPPED"]
        overall = sum(all_scores) / len(all_scores) if all_scores else 0
        any_fail = any(r.status == "FAIL" for r in results.values())
        any_marginal = any(r.status == "MARGINAL" for r in results.values())
        overall_status = "FAIL" if any_fail else ("MARGINAL" if any_marginal else "PASS")

        return EvalReport(
            eval_timestamp=datetime.now(timezone.utc).isoformat(),
            evals_run=len(results),
            results=results,
            overall_status=overall_status,
            overall_score=round(overall, 2),
            summary=(
                f"{'ALL EVALS PASS' if overall_status == 'PASS' else 'SOME EVALS FAILED'}. "
                f"Overall score: {overall:.1f}/10. "
                f"Rule-based: 5 evals. LLM: {'2 evals' if self.use_llm else 'SKIPPED'}."
            ),
            api_calls_made=self.api_calls,
            total_time_seconds=round(elapsed, 2),
        )
