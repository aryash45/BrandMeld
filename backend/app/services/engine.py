"""
engine.py — BrandMeld Personal Distribution Engine
====================================================

Single unified service that replaces factory.py, auditor.py, and the
standalone /v1/discovery route.

Architecture
------------
  DiscoveryService  — scrapes a URL → BrandDNA (Playwright + Gemini vision)
  _audit_content    — internal self-correction step (never exposed as an API)
  campaign router   — /v1/campaign/* endpoints:
      POST /v1/campaign/launch     — zero-config batch launch (X + LinkedIn + Instagram)
      POST /v1/campaign/edit       — inline tone edit with undo support
      POST /v1/campaign/onboard    — scrape URL → store Brand DNA in Supabase
      GET  /v1/campaign/watchdog   — lightweight poll for new products on a URL

SDK: google-genai >= 1.0.0 (unified, new SDK only)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
from html import unescape
from typing import Annotated
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query
from google import genai
from google.genai import types as genai_types
from playwright.async_api import async_playwright
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

MODEL_ID = "gemini-2.0-flash-exp"

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _get_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set")
    return key


def _get_client() -> genai.Client:
    """Return a configured google-genai Client (new SDK)."""
    return genai.Client(api_key=_get_api_key())


# ─── Brand DNA ────────────────────────────────────────────────────────────────


class BrandDNA(BaseModel):
    brand_name: str
    primary_hex: str
    typography: list[str]
    voice_personality: str
    banned_concepts: list[str]


# ─── Discovery (internal + exposed via /onboard) ──────────────────────────────


def _normalize_url(url: str) -> str:
    candidate = url.strip()
    if not candidate:
        raise ValueError("A website URL is required for brand discovery")
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"Invalid URL: {url!r}")
    return candidate


async def _capture_screenshot(url: str) -> bytes | None:
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(viewport={"width": 1440, "height": 2200})
                await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
                await page.wait_for_timeout(1500)
                return await page.screenshot(full_page=True)
            finally:
                await browser.close()
    except Exception as exc:
        logger.warning("Screenshot failed for %s: %s", url, exc)
        return None


def _extract_meta(html: str, name: str) -> str | None:
    patterns = [
        rf'<meta[^>]*name=["\']{name}["\'][^>]*content=["\'](.*?)["\']',
        rf'<meta[^>]*content=["\'](.*?)["\'][^>]*name=["\']{name}["\']',
        rf'<meta[^>]*property=["\'"]og:{name}["\'][^>]*content=["\'](.*?)["\']',
        rf'<meta[^>]*content=["\'](.*?)["\'][^>]*property=["\'"]og:{name}["\']',
    ]
    for pat in patterns:
        m = re.search(pat, html, flags=re.IGNORECASE | re.DOTALL)
        if m:
            return unescape(re.sub(r"\s+", " ", m.group(1))).strip()
    return None


def _fetch_page_context(url: str) -> str | None:
    req = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/133.0.0.0 Safari/537.36"
            )
        },
    )
    try:
        with urlopen(req, timeout=15) as resp:
            ct = (resp.headers.get("Content-Type") or "").lower()
            if ct and "text/html" not in ct and "application/xhtml+xml" not in ct:
                return None
            html_bytes = resp.read(250_000)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.warning("Page fetch failed for %s: %s", url, exc)
        return None

    html = html_bytes.decode("utf-8", errors="ignore")
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    title = unescape(re.sub(r"\s+", " ", title_m.group(1))).strip() if title_m else ""
    desc = _extract_meta(html, "description")

    visible = re.sub(r"(?is)<(script|style|noscript|svg).*?>.*?</\1>", " ", html)
    visible = re.sub(r"(?is)<!--.*?-->", " ", visible)
    visible = re.sub(r"(?is)<[^>]+>", " ", visible)
    visible = unescape(re.sub(r"\s+", " ", visible)).strip()

    parts = [f"Website URL: {url}", f"Hostname: {urlparse(url).netloc}"]
    if title:
        parts.append(f"Page title: {title}")
    if desc:
        parts.append(f"Meta description: {desc}")
    if visible:
        parts.append(f"Visible text excerpt: {visible[:6000]}")
    return "\n".join(parts)


async def _extract_brand_dna(url: str) -> BrandDNA:
    """Core discovery routine — Playwright screenshot + Gemini vision → BrandDNA."""
    normalized = _normalize_url(url)
    screenshot, page_ctx = await asyncio.gather(
        _capture_screenshot(normalized),
        asyncio.to_thread(_fetch_page_context, normalized),
    )

    if screenshot is None and not page_ctx:
        raise RuntimeError(
            "Brand discovery could not reach the website. "
            "Try a public URL or allow the browser runtime."
        )

    client = _get_client()
    prompt = (
        "Analyze this brand's website and return BrandDNA JSON. "
        "Use the screenshot when available. "
        "If only text context is available, infer carefully from copy, metadata, and page structure."
    )
    contents: list[object] = [prompt, f"Target website: {normalized}"]
    if page_ctx:
        contents.append(page_ctx)
    if screenshot:
        contents.append(genai_types.Part.from_bytes(screenshot, mime_type="image/png"))

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=BrandDNA,
            thinking_config={"thinking_level": "high"},
        ),
    )
    if response.parsed is None:
        raise RuntimeError("Brand discovery returned an empty response from Gemini")
    return response.parsed


# ─── Internal Auditor (self-correction step) ──────────────────────────────────


_AUDIT_INSTRUCTION = """You are a personal brand editor.
Scan this draft against the voice profile below and rewrite ONLY the sentences
that feel corporate, generic, or inconsistent with the author's voice.
Return ONLY the corrected draft — no commentary, no scores, no headers.
If the draft is already on-brand, return it unchanged."""


async def _self_correct(draft: str, voice: str) -> str:
    """Run draft through internal audit + rewrite loop (never surfaced to user)."""
    client = _get_client()
    prompt = f"[VOICE PROFILE]\n{voice}\n\n[DRAFT]\n{draft}"
    resp = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=_AUDIT_INSTRUCTION,
            temperature=0.4,
            top_p=0.9,
        ),
    )
    return (resp.text or "").strip() or draft


# ─── Platform constraints ─────────────────────────────────────────────────────


PLATFORM_CONSTRAINTS: dict[str, str] = {
    "twitter": (
        "PLATFORM: X / Twitter Thread\n"
        "- Write as a numbered thread (1/, 2/, 3/...)\n"
        "- Each tweet must be under 280 chars INCLUDING the number prefix\n"
        "- Start with a strong hook tweet that stands alone\n"
        "- End with a CTA or summary tweet\n"
        "- No filler. Every tweet must add value."
    ),
    "linkedin": (
        "PLATFORM: LinkedIn Post\n"
        "- Hook-Story-Insight-CTA format\n"
        "- Hook: first 2 lines must stop the scroll (no 'Excited to share...' openers)\n"
        "- 150-300 words total; short paragraphs (1-2 sentences max)\n"
        "- End with a single question or CTA\n"
        "- 3-5 relevant hashtags on the last line"
    ),
    "instagram": (
        "PLATFORM: Instagram Caption\n"
        "- Conversational and authentic — a person talking, not a brand\n"
        "- 100-150 words\n"
        "- Start with an attention-grabbing first line\n"
        "- Short punchy paragraphs\n"
        "- End with 5-8 relevant hashtags on a new line"
    ),
    "newsletter": (
        "PLATFORM: Email Newsletter Section\n"
        "- Thought-leadership opener paragraph (2-3 sentences)\n"
        "- 250-400 words total; use subheadings if helpful\n"
        "- Write like you're emailing a smart friend\n"
        "- End with a clear CTA (reply, click, share)\n"
        "- NO subject line — just body content"
    ),
}

_GENERATOR_INSTRUCTION = """You are 'BrandMeld,' an expert personal branding and marketing AI.

CORE DIRECTIVE: Ghostwrite content that sounds EXACTLY like the persona in [BRAND_VOICE].

CRITICAL STYLE RULES:
1. If the brand voice implies an individual, ALWAYS use "I" and "my" instead of "we" or "us".
2. Avoid buzzwords like "synergy," "leveraging," or "cutting-edge" unless the voice explicitly uses them.
3. Short paragraphs. Use formatting (bold, lists) for social readability.
4. Be opinionated. Good personal brands have a point of view.
5. Return ONLY the content in Markdown. No introductory filler.

Analyze [BRAND_VOICE] deeply before writing. Match sentence length, vocabulary complexity, emotional range.
"""


def _build_generation_prompt(voice: str, request: str, platform: str) -> str:
    constraints = PLATFORM_CONSTRAINTS.get(platform, "")
    return (
        f"**AUTHOR/BRAND VOICE PROFILE:**\n---\n{voice}\n---\n\n"
        f"**CONTENT TASK:**\n---\n{request}\n---\n\n"
        f"**PLATFORM REQUIREMENTS (FOLLOW STRICTLY):**\n---\n{constraints}\n---"
    )


async def _generate_for_platform(voice: str, request: str, platform: str) -> tuple[str, str]:
    """Generate + self-correct for a single platform. Returns (platform, content)."""
    client = _get_client()
    prompt = _build_generation_prompt(voice, request, platform)
    resp = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=_GENERATOR_INSTRUCTION,
            temperature=0.8,
            top_p=0.95,
        ),
    )
    draft = (resp.text or "").strip()
    # Internal audit pass — transparent to the user
    corrected = await _self_correct(draft, voice)
    return (platform, corrected)


# ─── Supabase helper (optional — graceful if not configured) ──────────────────


def _get_supabase():
    """Returns a Supabase client or None if env vars are missing."""
    try:
        from supabase import create_client  # type: ignore

        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


# ─── Request / Response models ────────────────────────────────────────────────


DEFAULT_PLATFORMS = ["twitter", "linkedin", "instagram"]


class CampaignLaunchRequest(BaseModel):
    content_request: str
    brand_voice: str | None = None          # optional; falls back to stored DNA voice
    brand_dna: BrandDNA | None = None       # optional pre-scraped DNA
    platforms: list[str] = DEFAULT_PLATFORMS


class CampaignLaunchResponse(BaseModel):
    results: dict[str, str]
    success: bool
    message: str = ""


class EditRequest(BaseModel):
    original_content: str
    brand_voice: str
    edit_command: str


class EditResponse(BaseModel):
    edited_content: str
    success: bool
    message: str = ""


class OnboardRequest(BaseModel):
    url: str
    user_id: str | None = None


class OnboardResponse(BaseModel):
    brand_dna: BrandDNA
    stored: bool
    message: str = ""


class WatchdogResponse(BaseModel):
    new_products_detected: bool
    draft_campaigns: list[dict] = []
    message: str = ""


# ─── Edit instructions ────────────────────────────────────────────────────────


_EDIT_INSTRUCTIONS: dict[str, str] = {
    "shorter":      "Make this significantly shorter (aim for 40-60% of original). Cut filler ruthlessly. Keep the core message.",
    "longer":       "Expand this. Add supporting points, a brief story or example. Don't add fluff.",
    "casual":       "Rewrite in a more casual, conversational tone. Sound like a smart friend texting.",
    "professional": "Rewrite in a more professional, polished tone. Suitable for a formal publication.",
    "hook":         "Rewrite ONLY the opening (first 1-2 sentences) to be more compelling. Leave the rest intact.",
    "bold":         "Rewrite to be bolder and punchier. Shorter sentences. Stronger verbs. More direct. Cut all hedging.",
}

_EDIT_SYSTEM = (
    "You are a personal brand editor. Apply the given editing instruction to the draft. "
    "Return ONLY the revised content. No commentary, no 'Here is the edited version:'. Just the content."
)


# ─── API Routes ───────────────────────────────────────────────────────────────


@router.post("/launch", response_model=CampaignLaunchResponse)
async def launch_campaign(req: CampaignLaunchRequest):
    """
    Zero-config batch campaign launch.
    Defaults to X, LinkedIn, and Instagram simultaneously.
    Runs internal audit self-correction on every draft.
    """
    voice = req.brand_voice
    if not voice and req.brand_dna:
        voice = req.brand_dna.voice_personality
    if not voice:
        raise HTTPException(
            status_code=422,
            detail="Provide brand_voice or brand_dna with a voice_personality.",
        )

    valid_platforms = [p for p in req.platforms if p in PLATFORM_CONSTRAINTS]
    if not valid_platforms:
        raise HTTPException(
            status_code=400,
            detail=f"No valid platforms. Choose from: {list(PLATFORM_CONSTRAINTS.keys())}",
        )

    try:
        tasks = [
            _generate_for_platform(voice, req.content_request, p)
            for p in valid_platforms
        ]
        results_list = await asyncio.gather(*tasks)
        results = dict(results_list)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Campaign generation failed: {exc}") from exc

    return CampaignLaunchResponse(
        results=results,
        success=True,
        message=f"Campaign generated for: {', '.join(valid_platforms)}",
    )


@router.post("/edit", response_model=EditResponse)
async def edit_draft(req: EditRequest):
    """Apply a human-action editing command to an existing draft."""
    instruction = _EDIT_INSTRUCTIONS.get(req.edit_command)
    if not instruction:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid edit_command. Choose from: {list(_EDIT_INSTRUCTIONS.keys())}",
        )
    try:
        client = _get_client()
        prompt = (
            f"[VOICE PROFILE]\n{req.brand_voice}\n\n"
            f"[ORIGINAL CONTENT TO EDIT]\n{req.original_content}\n\n"
            f"[EDITING INSTRUCTION]\n{instruction}"
        )
        resp = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=_EDIT_SYSTEM,
                temperature=0.7,
                top_p=0.92,
            ),
        )
        return EditResponse(
            edited_content=(resp.text or "").strip(),
            success=True,
            message=f"Applied: {req.edit_command}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Edit failed: {exc}") from exc


@router.post("/onboard", response_model=OnboardResponse)
async def onboard_brand(req: OnboardRequest):
    """
    Zero-config onboarding: scrape a URL → extract Brand DNA → store in Supabase.
    Called once when a user first sets up their account.
    """
    try:
        dna = await _extract_brand_dna(req.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Brand discovery failed: {exc}") from exc

    stored = False
    try:
        sb = _get_supabase()
        if sb:
            row = {**dna.model_dump(), "url": req.url, "user_id": req.user_id}
            sb.table("brand_dna").upsert(row, on_conflict="url").execute()
            stored = True
    except Exception as exc:
        logger.warning("Supabase save failed (non-fatal): %s", exc)

    return OnboardResponse(
        brand_dna=dna,
        stored=stored,
        message="Brand DNA extracted and stored." if stored else "Brand DNA extracted (Supabase not configured).",
    )


@router.get("/watchdog", response_model=WatchdogResponse)
async def watchdog_check(
    url: Annotated[str, Query(description="The brand's website URL to monitor")],
    last_known_hash: Annotated[str | None, Query()] = None,
):
    """
    Lightweight background watchdog — polls a URL for new product content.
    Compares the current visible text fingerprint against last_known_hash.
    If changes are detected, prepares draft campaign summaries automatically.
    """
    try:
        normalized = _normalize_url(url)
        page_ctx = await asyncio.to_thread(_fetch_page_context, normalized)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not page_ctx:
        return WatchdogResponse(new_products_detected=False, message="Could not fetch page.")

    current_hash = hashlib.md5(page_ctx.encode()).hexdigest()

    if last_known_hash and current_hash == last_known_hash:
        return WatchdogResponse(
            new_products_detected=False,
            message=f"No changes detected. hash={current_hash}",
        )

    # Changes detected — generate draft campaign summaries via Gemini
    draft_campaigns: list[dict] = []
    try:
        client = _get_client()
        prompt = (
            "You are a marketing strategist. Based on the following website content, "
            "identify up to 3 new products or announcements that would make great social campaigns. "
            "Return a JSON array of objects with keys: 'product_name', 'campaign_hook', 'platforms'. "
            "platforms should be an array from: ['twitter', 'linkedin', 'instagram'].\n\n"
            f"WEBSITE CONTENT:\n{page_ctx[:4000]}"
        )
        resp = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.6,
            ),
        )
        draft_campaigns = json.loads(resp.text or "[]")
        if not isinstance(draft_campaigns, list):
            draft_campaigns = []
    except Exception as exc:
        logger.warning("Watchdog draft generation failed: %s", exc)

    return WatchdogResponse(
        new_products_detected=True,
        draft_campaigns=draft_campaigns,
        message=f"Changes detected. hash={current_hash}",
    )


@router.get("/health")
async def engine_health():
    return {"status": "healthy", "service": "engine"}
