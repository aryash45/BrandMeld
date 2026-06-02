"""
BrandMeld API — main.py
========================
All traffic routes through /v1/campaign/* (V1) and /v1/* (V2).

Security
--------
Every route under /v1/* is protected by JWT middleware that validates
the Authorization: Bearer <token> header against the Supabase JWT secret.
Public routes: /health, /docs, /openapi.json, /redoc, /v1/auth/linkedin/callback
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
from app.services.engine import router as engine_router

# ── V2 routers ─────────────────────────────────────────────────────────────
from app.routers.publishing import router as publishing_router, linkedin_callback_router
from app.routers.analytics import router as analytics_router
from app.routers.marketplace import router as marketplace_router
from app.routers.prompts import router as prompts_router
from app.routers.settings import settings_router, onboarding_router, score_router

logger = logging.getLogger(__name__)

# ── JWT config ────────────────────────────────────────────────────────────────
# Routes that don't require a valid JWT
_PUBLIC_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/v1/auth/linkedin/callback",  # OAuth callback must be public
}


app = FastAPI(
    title="BrandMeld Personal Distribution Engine",
    description=(
        "Zero-config content generation for non-marketing users. "
        "Point it at your URL and tell it what you're promoting."
    ),
    version="2.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]


def _get_supabase_jwt_secret() -> str:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()


def _get_supabase_project_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip()


def _get_supabase_auth_key() -> str:
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )


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


async def _verify_supabase_token(token: str) -> bool:
    auth_client = _get_supabase_auth_client()
    if auth_client is None:
        return False
    try:
        user_response = await asyncio.to_thread(auth_client.get_user, token)
    except Exception as exc:
        logger.warning("Supabase token verification failed: %s", exc)
        return False
    return bool(getattr(user_response, "user", None))


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
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers middleware ────────────────────────────────────────────────
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path not in _PUBLIC_PATHS:
        response.headers.setdefault("Cache-Control", "no-store")
    return response


# ── JWT auth middleware ────────────────────────────────────────────────────────
@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    """
    Validate Authorization: Bearer <token> for all non-public routes.
    Attaches user_id to request.state for downstream use.
    """
    if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    jwt_secret = _get_supabase_jwt_secret()
    auth_client = _get_supabase_auth_client()

    # Dev mode: no verifier configured → let requests through
    if not jwt_secret and auth_client is None:
        logger.warning(
            "No Supabase token verifier configured — auth middleware is DISABLED. "
            "Set SUPABASE_JWT_SECRET for production."
        )
        request.state.user_id = "dev-user"
        return await call_next(request)

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
        elif auth_client is not None and await _verify_supabase_token(token):
            # Decode without verification just to extract sub
            payload = pyjwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
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

    # Attach user_id to request.state — used by all V2 routers
    request.state.user_id = user_id or "unknown"
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

# LinkedIn OAuth callback (public — no JWT required)
app.include_router(linkedin_callback_router, prefix="/v1")


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "healthy", "version": "2.0.0"}


# ── /v1/discovery shim — keeps useBrandKit + fetchBrandDNA working ────────────
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
async def discover(url: str):
    """Legacy discovery shim — delegates to engine._extract_brand_dna."""
    try:
        dna: _BrandDNA = await _extract_brand_dna(url)
        dna_data = {**dna.model_dump(), "url": url}
    except ValueError as exc:
        raise _HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise _HTTPException(status_code=500, detail=f"Brand discovery failed: {exc}") from exc

    try:
        db = _SupabaseService()
        saved = await db.save_brand_dna(dna_data)
        if isinstance(saved, list) and saved:
            return {"status": "success", "data": saved[0]}
        if saved:
            return {"status": "success", "data": saved}
    except Exception:
        pass  # Supabase optional — fall through

    return {"status": "success", "data": dna_data}
