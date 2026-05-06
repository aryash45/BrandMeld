"""
routers/settings.py — User settings and preferences.

GET  /v1/settings/preferences    — Fetch user preferences
PUT  /v1/settings/preferences    — Update preferences
POST /v1/settings/billing/upgrade — Initiate Stripe checkout (Phase 3 stub)

routers/onboarding.py — Onboarding wizard step tracking.

POST /v1/onboarding/complete     — Mark onboarding complete for user
GET  /v1/onboarding/status       — Check if user has completed onboarding
POST /v1/score                   — Authenticity scoring endpoint
"""
from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from app.models.marketplace import UserPreferences
from app.services import prompt_service

logger = logging.getLogger(__name__)

# ── Settings router ────────────────────────────────────────────────────────
settings_router = APIRouter(prefix="/settings", tags=["settings"])


def _user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


@settings_router.get("/preferences", response_model=UserPreferences)
async def get_preferences(request: Request):
    """Fetch user notification and prompt preferences."""
    user_id = _user_id(request)
    return await prompt_service.get_user_preferences(user_id)


@settings_router.put("/preferences", response_model=UserPreferences)
async def update_preferences(req: UserPreferences, request: Request):
    """Update user preferences. All fields optional (PATCH semantics)."""
    user_id = _user_id(request)
    await prompt_service.save_user_preferences(user_id, req)
    return req


class UpgradeRequest(BaseModel):
    plan: str  # 'pro' | 'team'
    billing_cycle: str = "monthly"  # 'monthly' | 'annual'


@settings_router.post("/billing/upgrade")
async def upgrade_billing(req: UpgradeRequest, request: Request):
    """
    Phase 3: Initiate Stripe checkout session.
    Currently returns a stub until Stripe is integrated.
    """
    _user_id(request)
    return {
        "success": False,
        "message": "Billing integration coming in Phase 3",
        "plan": req.plan,
    }


# ── Onboarding router ──────────────────────────────────────────────────────
onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingCompleteRequest(BaseModel):
    completed_steps: list[int]
    skipped: bool = False


@onboarding_router.get("/status")
async def get_onboarding_status(request: Request):
    """Check if authenticated user has completed onboarding."""
    user_id = _user_id(request)
    from app.config import get_settings
    from supabase import create_client
    s = get_settings()
    if not s.supabase_url:
        return {"completed": False, "step": 1}

    sb = create_client(s.supabase_url, s.supabase_service_role_key)
    try:
        # Onboarding is complete if brand_dna exists
        r = sb.table("brand_dna").select("id").eq("user_id", user_id).maybe_single().execute()
        has_dna = bool(r and r.data)
    except Exception as e:
        logger.warning("brand_dna check failed: %s", e)
        has_dna = False

    try:
        # Check preferences (set during step 7)
        prefs_r = sb.table("user_preferences").select("id").eq("user_id", user_id).maybe_single().execute()
        has_prefs = bool(prefs_r and prefs_r.data)
    except Exception as e:
        logger.warning("user_preferences check failed: %s", e)
        has_prefs = False

    completed = has_dna and has_prefs
    return {"completed": completed, "has_brand_dna": has_dna, "has_preferences": has_prefs}


@onboarding_router.post("/complete")
async def complete_onboarding(req: OnboardingCompleteRequest, request: Request):
    """Mark onboarding as completed by ensuring default preferences exist."""
    user_id = _user_id(request)
    prefs = await prompt_service.get_user_preferences(user_id)
    await prompt_service.save_user_preferences(user_id, prefs)
    return {"completed": True, "steps_done": req.completed_steps}


# ── Authenticity score router ──────────────────────────────────────────────
score_router = APIRouter(prefix="/score", tags=["scoring"])


class ScoreRequest(BaseModel):
    draft: str
    voice_personality: str
    platform: Optional[str] = None


@score_router.post("")
async def score_draft(req: ScoreRequest, request: Request):
    """
    Score a draft against a voice personality.
    Returns 4-dimension breakdown + overall score + improvement hints.
    Target latency: <2 seconds.
    """
    _user_id(request)
    from app.services.voice_service import score_draft as _score
    result = await _score(req.draft, req.voice_personality)
    return result
