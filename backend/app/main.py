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

import os
import logging

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
_SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth middleware ────────────────────────────────────────────────────────────
@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    """
    Validate Authorization: Bearer <token> for all non-public routes.
    Returns 401 if the token is missing or invalid.
    Skips validation when SUPABASE_JWT_SECRET is not configured (dev mode).
    """
    if request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    # If no JWT secret is configured, warn but let requests through (dev mode)
    if not _SUPABASE_JWT_SECRET:
        logger.warning(
            "SUPABASE_JWT_SECRET not set — auth middleware is DISABLED. "
            "Set this variable in production."
        )
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or malformed Authorization header. Expected: Bearer <token>"},
        )

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        pyjwt.decode(
            token,
            _SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},   # Supabase sets aud=authenticated; skip strict check
        )
    except pyjwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Token has expired."})
    except pyjwt.InvalidTokenError as exc:
        return JSONResponse(status_code=401, content={"detail": f"Invalid token: {exc}"})

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
