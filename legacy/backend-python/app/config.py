"""
config.py — Centralised settings loaded from environment variables.
All modules import from here instead of calling os.getenv directly.
"""
from __future__ import annotations
import os
from functools import lru_cache


class Settings:
    # ── API ───────────────────────────────────────────────────────────────
    port: int = int(os.getenv("PORT", "8080"))
    allowed_origins: list[str] = [
        o.strip()
        for o in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if o.strip()
    ]

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_jwt_secret: str = os.getenv("SUPABASE_JWT_SECRET", "")

    # ── LLM (NVIDIA NIM) ──────────────────────────────────────────────────
    nvidia_api_key: str = os.getenv("NVIDIA_API_KEY", "")
    nvidia_model_id: str = os.getenv("NVIDIA_MODEL_ID", "nvidia/llama-3.1-nemotron-70b-instruct")

    # ── Twitter / X ───────────────────────────────────────────────────────
    twitter_api_key: str = os.getenv("TWITTER_API_KEY", "")
    twitter_api_secret: str = os.getenv("TWITTER_API_SECRET", "")
    twitter_bearer_token: str = os.getenv("TWITTER_BEARER_TOKEN", "")
    # OAuth2 PKCE — needed if/when we get elevated API access
    twitter_client_id: str = os.getenv("TWITTER_CLIENT_ID", "")
    twitter_client_secret: str = os.getenv("TWITTER_CLIENT_SECRET", "")

    # ── LinkedIn ──────────────────────────────────────────────────────────
    linkedin_client_id: str = os.getenv("LINKEDIN_CLIENT_ID", "")
    linkedin_client_secret: str = os.getenv("LINKEDIN_CLIENT_SECRET", "")
    # Staging Cloud Run URL registered as the OAuth redirect base
    linkedin_redirect_uri: str = os.getenv(
        "LINKEDIN_REDIRECT_URI", "http://localhost:8080/v1/auth/linkedin/callback"
    )

    # ── Email / Mailgun ───────────────────────────────────────────────────
    mailgun_api_key: str = os.getenv("MAILGUN_API_KEY", "")
    mailgun_domain: str = os.getenv("MAILGUN_DOMAIN", "")
    mailgun_from: str = os.getenv("MAILGUN_FROM", "BrandMeld <noreply@brandmeld.app>")

    # ── Beehiiv ───────────────────────────────────────────────────────────
    beehiiv_api_key: str = os.getenv("BEEHIIV_API_KEY", "")
    beehiiv_publication_id: str = os.getenv("BEEHIIV_PUBLICATION_ID", "")

    # ── Analytics ─────────────────────────────────────────────────────────
    segment_write_key: str = os.getenv("SEGMENT_WRITE_KEY", "")

    # ── Token encryption ─────────────────────────────────────────────────
    # Fernet key — generate with: from cryptography.fernet import Fernet; Fernet.generate_key()
    encryption_key: str = os.getenv("ENCRYPTION_KEY", "")

    # ── App ───────────────────────────────────────────────────────────────
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    environment: str = os.getenv("ENVIRONMENT", "development").strip().lower()

    @property
    def is_production(self) -> bool:
        return self.environment in {"production", "prod"}

    def validate_production(self) -> None:
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            "ENCRYPTION_KEY": self.encryption_key,
        }
        if not self.supabase_jwt_secret and not self.supabase_anon_key:
            required["SUPABASE_JWT_SECRET or SUPABASE_ANON_KEY"] = ""
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError("Missing production configuration: " + ", ".join(missing))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
