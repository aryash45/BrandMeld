import os
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter()

class ImagenRequest(BaseModel):
    brand_colors: list[str]
    content_summary: str
    platform: str

class ImagenResponse(BaseModel):
    image_base64: str

@router.post('/generate', response_model=ImagenResponse)
async def generate_image(request: ImagenRequest):
    try:
        # Build a simple prompt describing the image
        colors = ', '.join(request.brand_colors)
        prompt = f"Create a minimalist social media card for {request.platform}. Use background color {colors}. Include the summary: '{request.content_summary}'. Aspect ratio suitable for {request.platform}. Return a PNG image."
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type='image/png'
            )
        )
        # Extract image bytes; assume first part contains the image blob
        image_part = response.candidates[0].content.parts[0]
        # The part may have 'blob' attribute with raw bytes
        image_bytes = getattr(image_part, 'blob', None)
        if not image_bytes:
            raise ValueError('No image data returned from Gemini')
        image_base64 = base64.b64encode(image_bytes).decode()
        return ImagenResponse(image_base64=image_base64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
