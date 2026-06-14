"""
engine.py — BrandMeld Personal Distribution Engine
====================================================

Single unified service that replaces factory.py, auditor.py, and the
standalone /v1/discovery route.

Architecture
------------
  DiscoveryService  — scrapes a URL → BrandDNA (Playwright + NVIDIA vision)
  _audit_content    — internal self-correction step (never exposed as an API)
  campaign router   — /v1/campaign/* endpoints:
      POST /v1/campaign/launch     — zero-config batch launch (X + LinkedIn + Instagram)
      POST /v1/campaign/edit       — inline tone edit with undo support
      POST /v1/campaign/onboard    — scrape URL → store Brand DNA in Supabase
      GET  /v1/campaign/watchdog   — lightweight poll for new products on a URL

SDK: NVIDIA NIM API (OpenAI-compatible)
"""

# from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import logging
import os
import re
import socket
from html import unescape
from typing import Annotated
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query, Request
from playwright.async_api import async_playwright
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.shared.deps import get_user_id

# Use shared LLM infrastructure instead of duplicating it
from app.core.llm import (
    get_llm_client as _get_client,
    get_model_id as _get_model_id,
    is_retryable_error as _is_retryable_gemini_error,
    generate_content_with_retry as _generate_content_with_retry,
    DEFAULT_MODEL_ID,
    LLM_RETRY_DELAYS as GEMINI_RETRY_DELAYS,
    Part,
    GenerateContentConfig,
)

class genai_types:
    Part = Part
    GenerateContentConfig = GenerateContentConfig
from app.shared.db import get_supabase_client as _get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()

# P1-7: Rate limiter — same instance as in main.py (shared via import)
limiter = Limiter(key_func=get_remote_address)

DEFAULT_PLATFORMS = ["twitter", "linkedin", "newsletter"]


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


# ─── Request / Response models ────────────────────────────────────────────────

class BrandDNA(BaseModel):
    brand_name: str
    primary_hex: str
    typography: list[str]
    voice_personality: str
    banned_concepts: list[str]


class CampaignBrief(BaseModel):
    what_changed: str = Field(min_length=1, max_length=2000)
    why_it_matters: str = Field(default="", max_length=2000)
    target_audience: str = Field(default="", max_length=1000)
    proof_points: list[str] = Field(default_factory=list, max_length=8)
    call_to_action: str = Field(default="", max_length=500)


class CampaignChannelPlan(BaseModel):
    platform: str
    format: str
    rationale: str


class CampaignAngle(BaseModel):
    title: str
    audience_focus: str
    core_message: str
    proof_to_use: list[str] = Field(default_factory=list)
    call_to_action: str
    why_this_works: str


class CampaignPlan(BaseModel):
    campaign_headline: str
    summary: str
    primary_angle: CampaignAngle
    alternate_angles: list[str] = Field(default_factory=list)
    channels: list[CampaignChannelPlan] = Field(default_factory=list)
    recommended_prompt: str
    approval_checklist: list[str] = Field(default_factory=list)


class CampaignPlanRequest(BaseModel):
    brief: CampaignBrief
    brand_voice: str | None = Field(default=None, max_length=5000)
    brand_dna: BrandDNA | None = None
    platforms: list[str] = Field(
        default_factory=lambda: DEFAULT_PLATFORMS.copy(),
        min_length=1,
        max_length=len(PLATFORM_CONSTRAINTS),
    )


class CampaignPlanResponse(BaseModel):
    plan: CampaignPlan
    success: bool
    message: str = ""


class CampaignLaunchRequest(BaseModel):
    content_request: str = Field(min_length=1, max_length=4000)
    brand_voice: str | None = Field(default=None, max_length=5000)  # optional; falls back to stored DNA voice
    brand_dna: BrandDNA | None = None       # optional pre-scraped DNA
    platforms: list[str] = Field(
        default_factory=lambda: DEFAULT_PLATFORMS.copy(),
        min_length=1,
        max_length=len(PLATFORM_CONSTRAINTS),
    )


class CampaignLaunchResponse(BaseModel):
    results: dict[str, str]
    success: bool
    message: str = ""


class EditRequest(BaseModel):
    original_content: str = Field(min_length=1, max_length=12000)
    brand_voice: str = Field(min_length=1, max_length=5000)
    edit_command: str = Field(min_length=1, max_length=32)


class EditResponse(BaseModel):
    edited_content: str
    success: bool
    message: str = ""


class OnboardRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class OnboardResponse(BaseModel):
    brand_dna: BrandDNA
    stored: bool
    message: str = ""


class WatchdogResponse(BaseModel):
    new_products_detected: bool
    draft_campaigns: list[dict] = Field(default_factory=list)
    message: str = ""


# ─── Discovery (internal + exposed via /onboard) ──────────────────────────────


def _is_blocked_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _enforce_public_url(parsed) -> None:
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname")
    if hostname.lower() == "localhost" or hostname.lower().endswith(".localhost"):
        raise ValueError("Private and localhost URLs are not allowed.")
    if _is_blocked_ip(hostname):
        raise ValueError("Private and localhost URLs are not allowed.")

    try:
        infos = socket.getaddrinfo(hostname, parsed.port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return

    for info in infos:
        address = info[4][0]
        if _is_blocked_ip(address):
            raise ValueError("Private and localhost URLs are not allowed.")


def _normalize_url(url: str) -> str:
    candidate = url.strip()
    if not candidate:
        raise ValueError("A website URL is required for brand discovery")
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"Invalid URL: {url!r}")
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http:// and https:// URLs are allowed.")
    if parsed.username or parsed.password:
        raise ValueError("URLs with embedded credentials are not allowed.")
    _enforce_public_url(parsed)
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
    """Core discovery routine — Playwright screenshot + NVIDIA vision → BrandDNA."""
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

    response = await _generate_content_with_retry(
        client=client,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=BrandDNA,
        ),
    )
    if response.parsed is None:
        raise RuntimeError("Brand discovery returned an empty response from the LLM. Please try again.")
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
    resp = await _generate_content_with_retry(
        client=client,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=_AUDIT_INSTRUCTION,
            temperature=0.4,
            top_p=0.9,
        ),
    )
    return (resp.text or "").strip() or draft


# Platform constraints moved to the top of the file

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

_PLANNER_SYSTEM = """You are BrandMeld's campaign strategist.

Your job is to turn product reality into founder-led marketing.
Do not write generic marketing fluff. Build a sharp plan for someone who hates marketing and needs clarity.
Prefer specific, proof-backed angles over vague inspiration.
"""


def _resolve_voice(brand_voice: str | None, brand_dna: BrandDNA | None) -> str:
    if brand_voice and brand_voice.strip():
        return brand_voice.strip()
    if brand_dna and brand_dna.voice_personality.strip():
        return brand_dna.voice_personality.strip()
    return "Confident, direct, and human. I explain why the product matters without sounding corporate."


def _normalize_platforms(platforms: list[str]) -> list[str]:
    return [platform for platform in platforms if platform in PLATFORM_CONSTRAINTS]


def _build_plan_prompt(brief: CampaignBrief, voice: str, platforms: list[str]) -> str:
    proof_points = "\n".join(f"- {item}" for item in brief.proof_points if item.strip()) or "- No proof points provided yet"
    platform_notes = "\n".join(
        f"- {platform}: {PLATFORM_CONSTRAINTS[platform].splitlines()[0]}"
        for platform in platforms
    )
    return (
        f"[BRAND VOICE]\n{voice}\n\n"
        f"[WHAT CHANGED]\n{brief.what_changed}\n\n"
        f"[WHY IT MATTERS]\n{brief.why_it_matters or 'Not provided'}\n\n"
        f"[TARGET AUDIENCE]\n{brief.target_audience or 'Founders and product-led buyers who need a simple explanation'}\n\n"
        f"[PROOF POINTS]\n{proof_points}\n\n"
        f"[CALL TO ACTION]\n{brief.call_to_action or 'Invite the reader to learn more or try the product'}\n\n"
        f"[CHANNELS]\n{platform_notes}\n\n"
        "Return a campaign plan that picks the strongest angle, explains why it works, and prepares this for approval before drafting."
    )


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
    resp = await _generate_content_with_retry(
        client=client,
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


async def _plan_campaign(
    brief: CampaignBrief,
    voice: str,
    platforms: list[str],
) -> CampaignPlan:
    client = _get_client()
    response = await _generate_content_with_retry(
        client=client,
        contents=_build_plan_prompt(brief, voice, platforms),
        config=genai_types.GenerateContentConfig(
            system_instruction=_PLANNER_SYSTEM,
            response_mime_type="application/json",
            response_schema=CampaignPlan,
            temperature=0.5,
        ),
    )
    if response.parsed is None:
        raise RuntimeError("Campaign planning returned an empty response from Gemini")
    return response.parsed


# (Supabase helper imported from app.shared.db as _get_supabase)

# ─── Request / Response models ────────────────────────────────────────────────


class CampaignBrief(BaseModel):
    what_changed: str = Field(min_length=1, max_length=2000)
    why_it_matters: str = Field(default="", max_length=2000)
    target_audience: str = Field(default="", max_length=1000)
    proof_points: list[str] = Field(default_factory=list, max_length=8)
    call_to_action: str = Field(default="", max_length=500)


class CampaignChannelPlan(BaseModel):
    platform: str
    format: str
    rationale: str


class CampaignAngle(BaseModel):
    title: str
    audience_focus: str
    core_message: str
    proof_to_use: list[str] = Field(default_factory=list)
    call_to_action: str
    why_this_works: str


class CampaignPlan(BaseModel):
    campaign_headline: str
    summary: str
    primary_angle: CampaignAngle
    alternate_angles: list[str] = Field(default_factory=list)
    channels: list[CampaignChannelPlan] = Field(default_factory=list)
    recommended_prompt: str
    approval_checklist: list[str] = Field(default_factory=list)


class CampaignPlanRequest(BaseModel):
    brief: CampaignBrief
    brand_voice: str | None = Field(default=None, max_length=5000)
    brand_dna: BrandDNA | None = None
    platforms: list[str] = Field(
        default_factory=lambda: DEFAULT_PLATFORMS.copy(),
        min_length=1,
        max_length=len(PLATFORM_CONSTRAINTS),
    )


class CampaignPlanResponse(BaseModel):
    plan: CampaignPlan
    success: bool
    message: str = ""


class CampaignLaunchRequest(BaseModel):
    content_request: str = Field(min_length=1, max_length=4000)
    brand_voice: str | None = Field(default=None, max_length=5000)  # optional; falls back to stored DNA voice
    brand_dna: BrandDNA | None = None       # optional pre-scraped DNA
    platforms: list[str] = Field(
        default_factory=lambda: DEFAULT_PLATFORMS.copy(),
        min_length=1,
        max_length=len(PLATFORM_CONSTRAINTS),
    )


class CampaignLaunchResponse(BaseModel):
    results: dict[str, str]
    success: bool
    message: str = ""


class EditRequest(BaseModel):
    original_content: str = Field(min_length=1, max_length=12000)
    brand_voice: str = Field(min_length=1, max_length=5000)
    edit_command: str = Field(min_length=1, max_length=32)


class EditResponse(BaseModel):
    edited_content: str
    success: bool
    message: str = ""


class OnboardRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    # P0-3: user_id is no longer accepted from the request body.
    # It is always derived from the authenticated JWT via request.state.


class OnboardResponse(BaseModel):
    brand_dna: BrandDNA
    stored: bool
    message: str = ""


class WatchdogResponse(BaseModel):
    new_products_detected: bool
    draft_campaigns: list[dict] = Field(default_factory=list)
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


@router.post("/plan", response_model=CampaignPlanResponse)
@limiter.limit("20/minute")  # P1-7: prevent Gemini API cost amplification
async def plan_campaign(req: CampaignPlanRequest, request: Request):
    """
    Turn a product update plus proof into an approval-ready campaign plan.
    P0-3: Requires authenticated user (user_id asserted from JWT).
    """
    user_id = get_user_id(request)  # P0-3: assert auth — logs which user is generating
    logger.info("Campaign plan requested by user %s", user_id)

    voice = _resolve_voice(req.brand_voice, req.brand_dna)
    valid_platforms = _normalize_platforms(req.platforms)
    if not valid_platforms:
        raise HTTPException(
            status_code=400,
            detail=f"No valid platforms. Choose from: {list(PLATFORM_CONSTRAINTS.keys())}",
        )

    try:
        plan = await _plan_campaign(req.brief, voice, valid_platforms)
    except Exception as exc:
        # P1-6: Log full details server-side; return generic message to client
        logger.error("Campaign planning failed for user %s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Campaign planning failed. Please try again.") from exc

    return CampaignPlanResponse(
        plan=plan,
        success=True,
        message=f"Campaign plan created for: {', '.join(valid_platforms)}",
    )


@router.post("/launch", response_model=CampaignLaunchResponse)
@limiter.limit("10/minute")  # P1-7: most expensive endpoint — parallel Gemini calls
async def launch_campaign(req: CampaignLaunchRequest, request: Request):
    """
    Zero-config batch campaign launch.
    Defaults to X, LinkedIn, and Instagram simultaneously.
    Runs internal audit self-correction on every draft.
    P0-3: Requires authenticated user.
    """
    user_id = get_user_id(request)  # P0-3: assert auth
    logger.info("Campaign launch requested by user %s for platforms %s", user_id, req.platforms)

    voice = req.brand_voice
    if not voice and req.brand_dna:
        voice = req.brand_dna.voice_personality
    if not voice:
        raise HTTPException(
            status_code=422,
            detail="Provide brand_voice or brand_dna with a voice_personality.",
        )
    valid_platforms = _normalize_platforms(req.platforms)
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
        # P1-6: Log full details server-side; return generic message to client
        logger.error("Campaign generation failed for user %s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Campaign generation failed. Please try again.") from exc

    return CampaignLaunchResponse(
        results=results,
        success=True,
        message=f"Campaign generated for: {', '.join(valid_platforms)}",
    )


@router.post("/edit", response_model=EditResponse)
@limiter.limit("30/minute")  # P1-7: rate limit edit endpoint
async def edit_draft(req: EditRequest, request: Request):
    """
    Apply a human-action editing command to an existing draft.
    P0-3: Requires authenticated user.
    """
    user_id = get_user_id(request)  # P0-3: assert auth
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
        resp = await _generate_content_with_retry(
            client=client,
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
        # P1-6: Log full error server-side, return generic message to client
        logger.error("Draft edit failed for user %s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Draft edit failed. Please try again.") from exc


@router.post("/onboard", response_model=OnboardResponse)
@limiter.limit("5/minute")  # P1-7: very expensive — Playwright browser + Gemini vision
async def onboard_brand(req: OnboardRequest, request: Request):
    """
    Zero-config onboarding: scrape a URL → extract Brand DNA → store in Supabase.
    Called once when a user first sets up their account.
    P0-3: user_id always derived from JWT — never accepted from the request body.
    """
    user_id = get_user_id(request)  # P0-3: enforce auth; user_id from JWT only
    try:
        dna = await _extract_brand_dna(req.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # P1-6: Log full error, return generic message
        logger.error("Brand discovery failed for user %s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Brand discovery failed. Please try again.") from exc

    stored = False
    try:
        sb = _get_supabase()
        if sb:
            # P0-3: user_id comes from JWT only — not from req body
            # source_url matches the schema column name; conflict on user_id (UNIQUE)
            row = {**dna.model_dump(), "source_url": req.url, "user_id": user_id}
            sb.table("brand_dna").upsert(row, on_conflict="user_id").execute()
            stored = True
    except Exception as exc:
        logger.warning("Supabase save failed (non-fatal): %s", exc)

    return OnboardResponse(
        brand_dna=dna,
        stored=stored,
        message="Brand DNA extracted and stored." if stored else "Brand DNA extracted (Supabase not configured).",
    )


@router.get("/watchdog", response_model=WatchdogResponse)
@limiter.limit("10/minute")  # P1-7: rate limit watchdog poll
async def watchdog_check(
    request: Request,
    url: str = Query(..., description="The brand's website URL to monitor"),
    last_known_hash: str | None = Query(default=None),
):
    """
    Lightweight background watchdog — polls a URL for new product content.
    Compares the current visible text fingerprint against last_known_hash.
    If changes are detected, prepares draft campaign summaries automatically.
    P0-3: Requires authenticated user.
    """
    user_id = get_user_id(request)  # P0-3: assert auth
    try:
        normalized = _normalize_url(url)
        page_ctx = await asyncio.to_thread(_fetch_page_context, normalized)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not page_ctx:
        return WatchdogResponse(new_products_detected=False, message="Could not fetch page.")

    current_hash = hashlib.sha256(page_ctx.encode()).hexdigest()

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
        resp = await _generate_content_with_retry(
            client=client,
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
        logger.warning("Watchdog draft generation failed for user %s: %s", user_id, exc)

    return WatchdogResponse(
        new_products_detected=True,
        draft_campaigns=draft_campaigns,
        message=f"Changes detected. hash={current_hash}",
    )


@router.get("/health")
async def engine_health():
    return {"status": "healthy", "service": "engine"}
