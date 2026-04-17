"""
BrandMeld API — main.py
========================
All traffic routes through /v1/campaign/*.

Security
--------
Every route under /v1/campaign/* (and legacy /api/*) is protected by
JWT middleware that validates the Authorization: Bearer <token> header
against the Supabase JWT secret.  Public routes: /health, /docs, /openapi.json.
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

# ── Legacy compatibility shims (kept so old /api/factory/* calls don't 404) ──
from app.services.factory import router as _factory_router  # noqa: F401
from app.services.auditor import router as _auditor_router  # noqa: F401
from app.services.imagen import router as _imagen_router    # noqa: F401

logger = logging.getLogger(__name__)

# ── JWT config ────────────────────────────────────────────────────────────────
# Routes that don't require a valid JWT
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


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


# ── Auth middleware ────────────────────────────────────────────────────────────
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


@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    """
    Validate Authorization: Bearer <token> for all non-public routes.
    Returns 401 if the token is missing or invalid.
    Skips validation when SUPABASE_JWT_SECRET is not configured (dev mode).
    """
    if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    jwt_secret = _get_supabase_jwt_secret()
    auth_client = _get_supabase_auth_client()

    # If no verifier is configured, warn but let requests through (dev mode)
    if not jwt_secret and auth_client is None:
        logger.warning(
            "No Supabase token verifier configured — auth middleware is DISABLED. "
            "Set SUPABASE_JWT_SECRET for symmetric JWTs or SUPABASE_URL with a Supabase auth key."
        )
        return await call_next(request)

    cors_headers = _build_cors_headers(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or malformed Authorization header. Expected: Bearer <token>"},
            headers=cors_headers
        )

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        header = pyjwt.get_unverified_header(token)
    except pyjwt.InvalidTokenError:
        return JSONResponse(status_code=401, content={"detail": "Invalid authentication token."}, headers=cors_headers)

    algorithm = str(header.get("alg", "")).upper()
    try:
        if algorithm.startswith("HS") and jwt_secret:
            pyjwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                options={"verify_aud": False},   # Supabase sets aud=authenticated; skip strict check
            )
        elif auth_client is not None and await _verify_supabase_token(token):
            pass
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

    return await call_next(request)


# ── Primary router — all new traffic goes here ─────────────────────────────────
app.include_router(engine_router, prefix="/v1/campaign", tags=["campaign"])

# ── Legacy shims — keep old clients working during migration ───────────────────
app.include_router(_factory_router, prefix="/api/factory", tags=["factory (deprecated)"])
app.include_router(_auditor_router, prefix="/api/auditor", tags=["auditor (deprecated)"])
app.include_router(_imagen_router,  prefix="/api/imagen",  tags=["imagen (deprecated)"])


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "healthy", "version": "2.0.0"}


# ── /v1/discovery shim — keeps useBrandKit + fetchBrandDNA working ────────────
from fastapi import HTTPException as _HTTPException  # noqa: E402
from app.services.engine import _extract_brand_dna, BrandDNA as _BrandDNA  # noqa: E402
from app.services.supabase import SupabaseService as _SupabaseService  # noqa: E402


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
