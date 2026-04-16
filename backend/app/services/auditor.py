"""
auditor.py — Legacy compatibility shim
Kept so /api/auditor/* calls don't 404 during transition.
All real logic now lives in engine.py (_self_correct).
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def auditor_health():
    return {"status": "deprecated", "message": "Use /v1/campaign/* instead."}
