"""
BrandMeld API — main.py
========================
All traffic routes through /v1/campaign/* (V1) and /v1/* (V2).

Security
--------
Every route under /v1/* is protected by JWT middleware that validates
the Authorization: Bearer <token> header against the Supabase JWT secret.
Public routes: /health, /docs, /openapi.json, /redoc, /v1/auth/linkedin/callback

OWASP fixes applied
-------------------
P0-1  Auth middleware hard-fails in production when env vars missing
P0-4  /v1/discovery requires auth
P1-2  JWT sub extracted from verified Supabase response object (not re-decoded)
P1-3  Missing sub → 401 (not "unknown")
P1-7  Rate limiting via slowapi
P2-1  Content-Security-Policy header added
P2-2  CORS restricted to specific methods and headers
P2-7  Anon key used for auth client (not service role key)
"""

from dotenv import load_dotenv
load_dotenv()

import asyncio
import os
import logging
from functools import lru_cache

import jwt as pyjwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.services.engine import router as engine_router

# ── V2 routers ─────────────────────────────────────────────────────────────
from app.routers.publishing import router as publishing_router, linkedin_callback_router
from app.routers.analytics import router as analytics_router
from app.routers.marketplace import router as marketplace_router
from app.routers.prompts import router as prompts_router
from app.routers.settings import settings_router, onboarding_router, score_router
from app.routers.autopilot import router as autopilot_router
from app.shared.deps import get_user_id
from app.shared.rate_limit import limiter

logger = logging.getLogger(__name__)

# ── Rate limiter (P1-7) ───────────────────────────────────────────────────────

# ── JWT config ────────────────────────────────────────────────────────────────
# Routes that don't require a valid JWT
_PUBLIC_PATHS = {
    "/health",
    "/ready",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/v1/auth/linkedin/callback",  # OAuth callback must be public
    "/v1/auth/register",
}


app = FastAPI(
    title="BrandMeld Personal Distribution Engine",
    description=(
        "Zero-config content generation for non-marketing users. "
        "Point it at your URL and tell it what you're promoting."
    ),
    version="2.0.0",
)

@app.on_event("startup")
async def validate_startup_configuration() -> None:
    from app.config import get_settings
    settings = get_settings()
    if settings.is_production:
        settings.validate_production()

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS (P2-2: restrict methods and headers) ─────────────────────────────────
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]


def _get_supabase_jwt_secret() -> str:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()


def _get_supabase_project_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip()


# P2-7: Use anon key for auth client — not service role key
def _get_supabase_auth_key() -> str:
    """
    Returns the anon key for auth token validation.
    The anon key is sufficient for auth.get_user() — service role key
    is not required here and would be over-privileged.
    """
    return os.getenv("SUPABASE_ANON_KEY", "").strip()


@lru_cache(maxsize=8)
def _build_supabase_auth_client(url: str, key: str):
    from supabase import create_client
    return create_client(url, key).auth


def _get_supabase_auth_client():
    url = _get_supabase_project_url()
    key = _get_supabase_auth_key()
    if not url or not key:
        return None
    return _build_supabase_auth_client(url, key)


async def _verify_supabase_token(token: str) -> tuple[bool, str | None]:
    """
    Verify token via Supabase auth API.
    Returns (is_valid, user_id).
    P1-2 fix: returns user_id from the verified response object directly
    instead of re-decoding the JWT without signature verification.
    """
    auth_client = _get_supabase_auth_client()
    if auth_client is None:
        return False, None
    try:
        user_response = await asyncio.to_thread(auth_client.get_user, token)
        user = getattr(user_response, "user", None)
        if user and getattr(user, "id", None):
            return True, str(user.id)
        return False, None
    except Exception as exc:
        logger.warning("Supabase token verification failed: %s", exc)
        return False, None


def _build_cors_headers(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin", "")
    if origin and (origin in _allowed_origins or "*" in _allowed_origins):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    # P2-2: Restrict to only required methods and headers
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


# ── Security headers middleware (P2-1: CSP added) ────────────────────────────
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    # P2-1: Content-Security-Policy
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; connect-src 'self' https://*.supabase.co; "
        "script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    )
    if request.url.path not in _PUBLIC_PATHS:
        response.headers.setdefault("Cache-Control", "no-store")
    return response


# ── JWT auth middleware ────────────────────────────────────────────────────────
@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    """
    Validate Authorization: Bearer <token> for all non-public routes.
    Attaches user_id to request.state for downstream use.

    OWASP fixes:
    - P0-1: Hard-fail in production when no verifier is configured
    - P1-2: user_id extracted from verified Supabase response, not re-decoded JWT
    - P1-3: Missing sub → 401 (never falls through as "unknown")
    """
    if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    jwt_secret = _get_supabase_jwt_secret()
    auth_client = _get_supabase_auth_client()

    # Authentication is never disabled. Misconfiguration is an unavailable service.
    if not jwt_secret and auth_client is None:
        logger.critical("No Supabase token verifier is configured")
        return JSONResponse(status_code=503, content={"detail": "Authentication service unavailable."})

    cors_headers = _build_cors_headers(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or malformed Authorization header. Expected: Bearer <token>"},
            headers=cors_headers,
        )

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        header = pyjwt.get_unverified_header(token)
    except pyjwt.InvalidTokenError:
        return JSONResponse(status_code=401, content={"detail": "Invalid authentication token."}, headers=cors_headers)

    algorithm = str(header.get("alg", "")).upper()
    user_id: str | None = None
    try:
        if algorithm.startswith("HS") and jwt_secret:
            payload = pyjwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                options={"verify_aud": False},
            )
            user_id = payload.get("sub")
        elif auth_client is not None:
            # P1-2: Extract user_id from verified Supabase response object
            # NOT from a second unverified decode
            is_valid, verified_user_id = await _verify_supabase_token(token)
            if is_valid:
                user_id = verified_user_id
            else:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid authentication token."},
                    headers=cors_headers,
                )
        else:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authentication token."},
                headers=cors_headers,
            )
    except pyjwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Token has expired."}, headers=cors_headers)
    except pyjwt.InvalidTokenError:
        return JSONResponse(status_code=401, content={"detail": "Invalid authentication token."}, headers=cors_headers)

    # P1-3: Reject tokens with missing sub — never fall through as "unknown"
    if not user_id:
        return JSONResponse(
            status_code=401,
            content={"detail": "Token is missing required subject claim."},
            headers=cors_headers,
        )

    # Attach user_id to request.state — used by all V2 routers
    request.state.user_id = user_id
    return await call_next(request)


# ── V1 Campaign router (existing) ─────────────────────────────────────────────
app.include_router(engine_router, prefix="/v1/campaign", tags=["campaign"])

# ── V2 routers ────────────────────────────────────────────────────────────────
app.include_router(publishing_router, prefix="/v1")
app.include_router(analytics_router, prefix="/v1")
app.include_router(marketplace_router, prefix="/v1")
app.include_router(prompts_router, prefix="/v1")
app.include_router(settings_router, prefix="/v1")
app.include_router(onboarding_router, prefix="/v1")
app.include_router(score_router, prefix="/v1")
app.include_router(autopilot_router, prefix="/v1")

# LinkedIn OAuth callback (public — no JWT required)
app.include_router(linkedin_callback_router, prefix="/v1")


from pydantic import BaseModel

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = None

@app.post("/v1/auth/register", tags=["auth"])
@limiter.limit("3/minute")
async def register(req: RegisterRequest, request: Request):
    """
    Register a user directly using admin access to auto-confirm email.
    Bypasses Supabase email rate limits and verification step for developer/testing convenience.
    """
    from fastapi import HTTPException
    auth_client = _get_supabase_auth_client()
    if auth_client is None:
        raise HTTPException(status_code=503, detail="Database client not configured")
    try:
        attrs = {
            "email": req.email,
            "password": req.password,
            "options": {"data": {"name": req.name or req.email.split("@")[0]}},
        }
        user_response = await asyncio.to_thread(auth_client.sign_up, attrs)
        if not user_response or not getattr(user_response, "user", None):
            raise HTTPException(status_code=400, detail="Registration could not be completed.")
        return {"status": "success", "user_id": str(user_response.user.id)}
    except Exception as exc:
        logger.warning("User registration failed: %s", type(exc).__name__)
        raise HTTPException(status_code=400, detail="Registration could not be completed.") from exc

class ImagenRequest(BaseModel):
    brand_colors: list[str]
    content_summary: str
    platform: str

@app.post("/api/imagen/generate", tags=["imagen (deprecated)"])
async def generate_image(req: ImagenRequest):
    from fastapi import HTTPException
    raise HTTPException(
        status_code=503,
        detail=(
            "Image generation is not available in v0. "
            "Gemini Flash does not return image blobs via the generate_content() method. "
            "Real image gen (Imagen 3 / Photoroom) ships in v1."
        ),
    )

@app.get("/health", tags=["meta"])
async def health():
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/ready", tags=["meta"])
async def readiness():
    from app.config import get_settings
    settings = get_settings()
    try:
        if settings.is_production:
            settings.validate_production()
        return {"status": "ready"}
    except RuntimeError:
        return JSONResponse(status_code=503, content={"status": "not_ready"})


# ── /v1/discovery shim — keeps useBrandKit + fetchBrandDNA working ────────────
# P0-4: Now requires authentication
from fastapi import HTTPException as _HTTPException  # noqa: E402
from app.services.engine import _extract_brand_dna, BrandDNA as _BrandDNA  # noqa: E402


def _get_supabase_for_discovery():
    """Returns a Supabase client or None if env vars are missing."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


@app.post("/v1/discovery", tags=["discovery (deprecated)"])
@limiter.limit("5/minute")
async def discover(request: Request, url: str):
    """
    Legacy discovery shim — delegates to engine._extract_brand_dna.
    P0-4: Requires authentication (user_id extracted from JWT).
    """
    user_id = get_user_id(request)  # P0-4: enforces auth
    try:
        dna: _BrandDNA = await _extract_brand_dna(url)
        dna_data = dna.model_dump()
    except ValueError as exc:
        raise _HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        # P1-6: Do not expose raw exception details
        logger.error("Brand discovery failed for user %s", user_id, exc_info=True)
        raise _HTTPException(status_code=500, detail="Brand discovery failed. Please try again.")

    try:
        db = _get_supabase_for_discovery()
        if db:
            row = {**dna_data, "user_id": user_id, "source_url": url}
            saved = db.table("brand_dna").upsert(row, on_conflict="user_id").execute()
            if saved.data:
                return {"status": "success", "data": saved.data[0]}
    except Exception:
        pass  # Supabase optional — fall through

    return {"status": "success", "data": dna_data}
