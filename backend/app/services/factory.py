"""
factory.py — Legacy compatibility shim
Kept so /api/factory/* calls don't 404 during transition.
All real logic now lives in engine.py.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def factory_health():
    return {"status": "deprecated", "message": "Use /v1/campaign/* instead."}
