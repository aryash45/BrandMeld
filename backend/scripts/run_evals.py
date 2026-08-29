#!/usr/bin/env python
"""
scripts/run_evals.py — Run all 7 BrandMeld Feature 1 evals.

Evals 1-5: Rule-based (offline, no API key needed)
Evals 6-7: LLM-based (requires NVIDIA_API_KEY)

Usage:
    cd backend

    # Run all 7 evals (evals 6-7 need API key)
    python scripts/run_evals.py

    # Rule-based only (no API key required)
    python scripts/run_evals.py --no-llm

    # Save report to JSON
    python scripts/run_evals.py --output eval_report.json

    # Verbose (show all test case details)
    python scripts/run_evals.py --verbose

Exit codes:
    0 = all evals PASS
    1 = one or more evals FAIL
    2 = runtime error
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time

# ── Path setup ─────────────────────────────────────────────────────────────────
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(_BACKEND_ROOT, ".env"))

logging.basicConfig(
    level=logging.WARNING,       # quiet during eval run — results printed separately
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.ERROR)

from agent.evaluator import Evaluator
from agent.models import EvalReport, EvalResult


# ─── Formatting helpers ────────────────────────────────────────────────────────

STATUS_ICONS = {
    "PASS": "✅",
    "FAIL": "❌",
    "MARGINAL": "⚠️ ",
    "SKIPPED": "⏭️ ",
}


def _print_eval_result(name: str, result: EvalResult, verbose: bool) -> None:
    icon = STATUS_ICONS.get(result.status, "?")
    score_bar = "█" * int(result.score) + "░" * (10 - int(result.score))
    print(f"  {icon} {result.eval_name}")
    print(f"     Score: [{score_bar}] {result.score:.1f}/10  "
          f"({result.passed_count}✅ {result.failed_count}❌)")
    print(f"     {result.details}")

    if verbose and result.test_cases:
        for tc in result.test_cases:
            tc_icon = "✅" if tc.get("passed") else "❌"
            tc_name = tc.get("name", "unnamed")
            notes = tc.get("notes", "")
            print(f"       {tc_icon} {tc_name}: {notes}")
    print()


def _print_report(report: EvalReport, verbose: bool) -> None:
    print("\n" + "=" * 65)
    print("  BRANDMELD FEATURE 1 — EVAL REPORT")
    print("=" * 65)
    print(f"  Timestamp  : {report.eval_timestamp}")
    print(f"  Evals Run  : {report.evals_run}")
    print(f"  LLM Calls  : {report.api_calls_made}")
    print(f"  Time       : {report.total_time_seconds:.1f}s")
    print(f"  Status     : {STATUS_ICONS.get(report.overall_status, '?')} {report.overall_status}")
    print(f"  Score      : {report.overall_score:.1f}/10")
    print("=" * 65 + "\n")

    for name, result in report.results.items():
        _print_eval_result(name, result, verbose)

    print("─" * 65)
    print(f"  SUMMARY: {report.summary}")
    print("─" * 65)


async def run(args: argparse.Namespace) -> int:
    use_llm = not args.no_llm

    if use_llm and not os.getenv("NVIDIA_API_KEY"):
        print("\n⚠️  NVIDIA_API_KEY not set — LLM evals (6, 7) will be skipped.")
        print("   Run with --no-llm to suppress this warning, or set the API key.\n")
        use_llm = False

    print(f"\n🔬 Running {'all 7' if use_llm else '5 rule-based'} evals…")
    print(f"   LLM evals: {'enabled' if use_llm else 'DISABLED (--no-llm)'}\n")

    evaluator = Evaluator(use_llm=use_llm)
    report = await evaluator.run_all()

    _print_report(report, args.verbose)

    if args.output:
        output_path = args.output
        if not os.path.isabs(output_path):
            output_path = os.path.join(_BACKEND_ROOT, "scripts", output_path)
        with open(output_path, "w") as f:
            json.dump(report.model_dump(), f, indent=2)
        print(f"\n💾 Report saved → {output_path}")

    # Exit code
    if report.overall_status == "FAIL":
        print("\n❌ EVAL RUN FAILED — fix issues before shipping Feature 1.\n")
        return 1
    elif report.overall_status == "MARGINAL":
        print("\n⚠️  EVAL RUN MARGINAL — review flagged evals.\n")
        return 0
    else:
        print("\n✅ ALL EVALS PASS — Feature 1 is ready to ship.\n")
        return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="BrandMeld Feature 1 eval runner")
    p.add_argument("--no-llm", action="store_true", help="Run only rule-based evals (offline)")
    p.add_argument("--output", default=None, metavar="FILE", help="Save report JSON to file")
    p.add_argument("--verbose", "-v", action="store_true", help="Show per-test-case details")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        exit_code = asyncio.run(run(args))
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nInterrupted.")
        sys.exit(2)
    except Exception as exc:
        print(f"\n❌ Eval runner error: {exc}")
        sys.exit(2)
