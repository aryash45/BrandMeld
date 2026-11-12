"""
BrandMeld — Minimal API server (agentic architecture).

This file is intentionally lean. The agent logic lives in backend/agent/.
The REST API here exists solely for:
  - /health and /ready (Cloud Run probes)
  - Future: /v1/approvals (Slack approval queue — Feature 2)

To run:
    uvicorn app.main:app --reload --port 8080
"""

from dotenv import load_dotenv
load_dotenv()

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BrandMeld Agent API",
    description="Minimal REST layer. Core logic runs in backend/agent/.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url=None,
)

# ── CORS (localhost only for now) ─────────────────────────────────────────────

_allowed_origins = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Health probes ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> JSONResponse:
    """Cloud Run liveness probe."""
    return JSONResponse({"status": "ok"})


@app.get("/ready", tags=["ops"])
async def ready() -> JSONResponse:
    """Cloud Run readiness probe."""
    return JSONResponse({"status": "ready"})


# ── Future: Approval queue (Feature 2) ───────────────────────────────────────
# from app.routers.approvals import router as approvals_router
# app.include_router(approvals_router, prefix="/v1")
