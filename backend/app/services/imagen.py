"""
imagen.py — Legacy image generation shim
This endpoint is disabled in v0 because gemini-2.0-flash-exp does not
return image blobs via generate_content(). Real image generation will
be added in v1 using Imagen 3 or Photoroom API.

The route is kept so /api/imagen/* calls return a clean 503 instead of 404.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ImagenRequest(BaseModel):
    brand_colors: list[str]
    content_summary: str
    platform: str


@router.post("/generate")
async def generate_image(request: ImagenRequest):
    raise HTTPException(
        status_code=503,
        detail=(
            "Image generation is not available in v0. "
            "Gemini Flash does not return image blobs via the generate_content() method. "
            "Real image gen (Imagen 3 / Photoroom) ships in v1."
        ),
    )


@router.get("/health")
async def imagen_health():
    return {"status": "disabled", "message": "Image generation not available in v0. Ships in v1."}
