from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.discovery import DiscoveryService
from app.services.supabase import SupabaseService
from app.services.factory import router as factory_router
from app.services.auditor import router as auditor_router
from app.services.imagen import router as imagen_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(factory_router, prefix="/api/factory", tags=["factory"])
app.include_router(auditor_router, prefix="/api/auditor", tags=["auditor"])
app.include_router(imagen_router, prefix="/api/imagen", tags=["imagen"])

@app.post("/v1/discovery")
async def discover(url: str):
    service = DiscoveryService()
    dna = await service.extract_dna(url)
    dna_data = dna.model_dump()
    dna_data["url"] = url
    db = SupabaseService()
    saved_data = await db.save_brand_dna(dna_data)
    return {"status": "success", "data": saved_data}
