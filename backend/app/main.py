"""
BrandMeld API — main.py
========================
All traffic routes through /v1/campaign/*.
Legacy routers (factory, auditor, imagen) are retained as deprecated
pass-throughs via the engine router so existing frontend calls still work
during the transition period.
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.engine import router as engine_router

# ── Legacy compatibility shims (kept so old /api/factory/* calls don't 404) ──
# These are thin re-exports; no logic lives here any more.
from app.services.factory import router as _factory_router  # noqa: F401
from app.services.auditor import router as _auditor_router  # noqa: F401
from app.services.imagen import router as _imagen_router    # noqa: F401

app = FastAPI(
    title="BrandMeld Personal Distribution Engine",
    description=(
        "Zero-config content generation for non-marketing users. "
        "Point it at your URL and tell it what you're promoting."
    ),
    version="2.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

