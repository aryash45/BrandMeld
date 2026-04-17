"""
tests/test_api.py
=================
Integration-style tests for BrandMeld API endpoints.

Run with:
    pytest tests/ -v

Requires:
    pip install pytest pytest-asyncio httpx PyJWT

These tests use FastAPI's TestClient (sync) and AsyncClient (async) so no
live network calls are made — Gemini and Supabase are monkey-patched out.
"""

from __future__ import annotations

import os
import time
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

# ── JWT helpers ────────────────────────────────────────────────────────────────
_TEST_SECRET = "test-jwt-secret-for-unit-tests"
_TEST_USER_ID = "user_abc123"


def _make_token(expired: bool = False) -> str:
    now = int(time.time())
    payload = {
        "sub": _TEST_USER_ID,
        "aud": "authenticated",
        "iat": now - 3600 if expired else now,
        "exp": now - 1 if expired else now + 3600,
    }
    return jwt.encode(payload, _TEST_SECRET, algorithm="HS256")


# ── App fixture ────────────────────────────────────────────────────────────────
@pytest.fixture()
def client(monkeypatch):
    """Return a TestClient with SUPABASE_JWT_SECRET patched in."""
    monkeypatch.setenv("SUPABASE_JWT_SECRET", _TEST_SECRET)
    monkeypatch.setenv("GEMINI_API_KEY", "fake-api-key")
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key")

    # Import AFTER setting env vars so middleware picks them up
    from app.main import app  # noqa: PLC0415
    return TestClient(app, raise_server_exceptions=False)


# ══════════════════════════════════════════════════════════════════════════════
# Bug 1 — Auth middleware tests
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthMiddleware:
    def test_health_is_public(self, client):
        """GET /health must return 200 with no token."""
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_no_token_returns_401(self, client):
        """Protected route with no Authorization header → 401."""
        resp = client.post("/v1/campaign/launch", json={
            "content_request": "test",
            "brand_voice": "direct and punchy",
        })
        assert resp.status_code == 401
        assert "Authorization" in resp.json()["detail"] or "Missing" in resp.json()["detail"]

    def test_malformed_token_returns_401(self, client):
        """Bearer token that is not a valid JWT → 401."""
        resp = client.post(
            "/v1/campaign/launch",
            json={"content_request": "test", "brand_voice": "punchy"},
            headers={"Authorization": "Bearer not.a.real.jwt"},
        )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid authentication token."

    def test_expired_token_returns_401(self, client):
        """Expired JWT → 401."""
        token = _make_token(expired=True)
        resp = client.post(
            "/v1/campaign/launch",
            json={"content_request": "test", "brand_voice": "punchy"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()

    def test_valid_token_passes_middleware(self, client):
        """Valid JWT is accepted by middleware (endpoint may still fail, but not 401)."""
        token = _make_token()

        # Patch genai so no real API call is made
        mock_resp = MagicMock()
        mock_resp.text = "Draft content for test."
        with patch("app.services.engine._get_client") as mock_client_fn:
            mock_gen = MagicMock()
            mock_gen.models.generate_content.return_value = mock_resp
            mock_client_fn.return_value = mock_gen

            resp = client.post(
                "/v1/campaign/launch",
                json={
                    "content_request": "Write about our AI product launch",
                    "brand_voice": "Direct, technical, first-person",
                    "platforms": ["twitter"],
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        # 401 must NOT happen — any other status (200, 422, 500) is fine for this test
        assert resp.status_code != 401

    def test_supabase_verified_token_passes_without_jwt_secret(self, client, monkeypatch):
        """Fallback Supabase verification should accept asymmetric-style tokens."""
        import base64
        import json

        def _b64(data: dict[str, str]) -> str:
            raw = json.dumps(data, separators=(",", ":")).encode()
            return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

        token = f"{_b64({'alg': 'RS256', 'typ': 'JWT'})}.{_b64({'sub': _TEST_USER_ID})}.sig"
        monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

        mock_resp = MagicMock()
        mock_resp.text = "Draft content for test."
        with patch("app.main._get_supabase_auth_client", return_value=object()), \
             patch("app.main._verify_supabase_token", new=AsyncMock(return_value=True)), \
             patch("app.services.engine._get_client") as mock_client_fn:
            mock_gen = MagicMock()
            mock_gen.models.generate_content.return_value = mock_resp
            mock_client_fn.return_value = mock_gen

            resp = client.post(
                "/v1/campaign/launch",
                json={
                    "content_request": "Write about our AI product launch",
                    "brand_voice": "Direct, technical, first-person",
                    "platforms": ["twitter"],
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code != 401

    def test_wrong_scheme_returns_401(self, client):
        """'Basic' scheme instead of 'Bearer' → 401."""
        resp = client.post(
            "/v1/campaign/launch",
            json={"content_request": "test", "brand_voice": "punchy"},
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        assert resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# Bug 2 — Image generation removed
# ══════════════════════════════════════════════════════════════════════════════

class TestImageGenRemoved:
    def test_imagen_endpoint_returns_503(self, client):
        """/api/imagen/generate must return 503, not silently return None."""
        token = _make_token()
        resp = client.post(
            "/api/imagen/generate",
            json={
                "brand_colors": ["#FF5733"],
                "content_summary": "A product launch post",
                "platform": "instagram",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 503
        assert "v0" in resp.json()["detail"].lower() or "not available" in resp.json()["detail"].lower()

    def test_launch_response_has_no_image_field(self, client):
        """CampaignLaunchResponse no longer contains image_base64."""
        token = _make_token()
        mock_resp = MagicMock()
        mock_resp.text = "Some generated content"
        with patch("app.services.engine._get_client") as mock_client_fn:
            mock_gen = MagicMock()
            mock_gen.models.generate_content.return_value = mock_resp
            mock_client_fn.return_value = mock_gen

            resp = client.post(
                "/v1/campaign/launch",
                json={
                    "content_request": "Announce our new feature",
                    "brand_voice": "Friendly and enthusiastic",
                    "platforms": ["linkedin"],
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        if resp.status_code == 200:
            data = resp.json()
            assert "image_base64" not in data, "image_base64 should be removed from response"
            assert "image_platform" not in data, "image_platform should be removed from response"


# ══════════════════════════════════════════════════════════════════════════════
# Bug 3 — SDK unification: google.generativeai must not be imported
# ══════════════════════════════════════════════════════════════════════════════

class TestSDKUnification:
    def test_old_sdk_not_imported_in_engine(self):
        """engine.py must NOT import google.generativeai (old SDK)."""
        engine_path = os.path.join(os.path.dirname(__file__), "..", "app", "services", "engine.py")
        with open(engine_path) as f:
            source = f.read()

        assert "import google.generativeai" not in source, (
            "engine.py still imports google.generativeai (old SDK). "
            "Migrate all usage to 'from google import genai'."
        )
        assert "google-generativeai" not in source, (
            "engine.py references google-generativeai package."
        )

    def test_old_sdk_not_in_requirements(self):
        """requirements.txt must NOT list google-generativeai."""
        req_path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
        with open(req_path) as f:
            reqs = f.read()
        assert "google-generativeai" not in reqs, (
            "google-generativeai is still in requirements.txt. Remove it."
        )

    def test_new_sdk_present_in_requirements(self):
        """requirements.txt must include google-genai."""
        req_path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
        with open(req_path) as f:
            reqs = f.read()
        assert "google-genai" in reqs, (
            "google-genai is missing from requirements.txt."
        )

    def test_engine_uses_genai_client(self):
        """engine.py must use genai.Client (new SDK pattern)."""
        with open("app/services/engine.py") as f:
            source = f.read()
        assert "genai.Client" in source or "_get_client" in source, (
            "engine.py does not use the new genai.Client pattern."
        )


# ══════════════════════════════════════════════════════════════════════════════
# Campaign launch — happy path
# ══════════════════════════════════════════════════════════════════════════════

class TestCampaignLaunch:
    def _authed_post(self, client, payload):
        token = _make_token()
        return client.post(
            "/v1/campaign/launch",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_missing_voice_returns_422(self, client):
        """No brand_voice and no brand_dna → 422."""
        resp = self._authed_post(client, {"content_request": "test"})
        assert resp.status_code == 422

    def test_invalid_platform_returns_400(self, client):
        """Unknown platform → 400."""
        mock_resp = MagicMock()
        mock_resp.text = "content"
        with patch("app.services.engine._get_client") as mock_fn:
            mock_fn.return_value.models.generate_content.return_value = mock_resp
            resp = self._authed_post(client, {
                "content_request": "test",
                "brand_voice": "punchy",
                "platforms": ["tiktok"],  # not supported
            })
        assert resp.status_code == 400

    def test_successful_launch_returns_results(self, client):
        """Valid request with mocked Gemini → 200 with results dict."""
        mock_resp = MagicMock()
        mock_resp.text = "Here is your generated content."
        with patch("app.services.engine._get_client") as mock_fn:
            mock_fn.return_value.models.generate_content.return_value = mock_resp
            resp = self._authed_post(client, {
                "content_request": "Announce our AI product",
                "brand_voice": "Direct and technical",
                "platforms": ["twitter", "linkedin"],
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "twitter" in data["results"]
        assert "linkedin" in data["results"]

    def test_launch_content_request_required(self, client):
        """Missing content_request field → 422 validation error."""
        resp = self._authed_post(client, {"brand_voice": "punchy"})
        assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Campaign edit
# ══════════════════════════════════════════════════════════════════════════════

class TestCampaignEdit:
    def _authed_post(self, client, payload):
        token = _make_token()
        return client.post(
            "/v1/campaign/edit",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_invalid_edit_command_returns_400(self, client):
        resp = self._authed_post(client, {
            "original_content": "Some content",
            "brand_voice": "casual",
            "edit_command": "make_it_purple",  # not a real command
        })
        assert resp.status_code == 400

    def test_valid_edit_command_returns_200(self, client):
        mock_resp = MagicMock()
        mock_resp.text = "Shorter version of the content."
        with patch("app.services.engine._get_client") as mock_fn:
            mock_fn.return_value.models.generate_content.return_value = mock_resp
            resp = self._authed_post(client, {
                "original_content": "This is a long piece of content that needs editing.",
                "brand_voice": "Direct and punchy",
                "edit_command": "shorter",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["edited_content"]) > 0


class TestCampaignPlanning:
    def _authed_post(self, client, payload):
        token = _make_token()
        return client.post(
            "/v1/campaign/plan",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_plan_requires_what_changed(self, client):
        resp = self._authed_post(client, {
            "brief": {
                "what_changed": "",
                "why_it_matters": "test",
                "target_audience": "founders",
                "proof_points": [],
                "call_to_action": "learn more",
            }
        })
        assert resp.status_code == 422

    def test_plan_returns_structured_response(self, client):
        from app.services.engine import CampaignAngle, CampaignChannelPlan, CampaignPlan

        mock_resp = MagicMock()
        mock_resp.parsed = CampaignPlan(
            campaign_headline="Launch the planning layer",
            summary="Explain the move from generic writing to campaign strategy.",
            primary_angle=CampaignAngle(
                title="Strategy before copy",
                audience_focus="Founders who hate blank prompts",
                core_message="Plan first, then write.",
                proof_to_use=["Explains why the angle works"],
                call_to_action="Try the planner",
                why_this_works="It makes the product feel strategic instead of generic.",
            ),
            alternate_angles=["Less fluff, more clarity"],
            channels=[
                CampaignChannelPlan(platform="twitter", format="Thread", rationale="Fast product update"),
                CampaignChannelPlan(platform="linkedin", format="Post", rationale="Explain the thinking"),
            ],
            recommended_prompt="Use the approved angle to generate drafts.",
            approval_checklist=["Include proof", "Keep the hook specific"],
        )

        with patch("app.services.engine._get_client") as mock_fn:
            mock_fn.return_value.models.generate_content.return_value = mock_resp
            resp = self._authed_post(client, {
                "brief": {
                    "what_changed": "We added campaign planning before draft generation.",
                    "why_it_matters": "Users now get a sharper angle before the app writes anything.",
                    "target_audience": "Technical founders",
                    "proof_points": ["Why this works explanation", "Approval checklist"],
                    "call_to_action": "Try the new workflow",
                },
                "platforms": ["twitter", "linkedin"],
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["plan"]["campaign_headline"] == "Launch the planning layer"
        assert data["plan"]["primary_angle"]["title"] == "Strategy before copy"


# ══════════════════════════════════════════════════════════════════════════════
# Watchdog
# ══════════════════════════════════════════════════════════════════════════════

class TestWatchdog:
    def test_watchdog_requires_url(self, client):
        token = _make_token()
        resp = client.get(
            "/v1/campaign/watchdog",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422  # missing required `url` query param

    def test_watchdog_invalid_url_returns_400(self, client):
        token = _make_token()
        with patch("app.services.engine._fetch_page_context", return_value=None), \
             patch("app.services.engine._normalize_url", side_effect=ValueError("bad url")):
            resp = client.get(
                "/v1/campaign/watchdog?url=not-a-url",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 400

    def test_watchdog_rejects_private_url_targets(self, client):
        token = _make_token()
        resp = client.get(
            "/v1/campaign/watchdog?url=http://127.0.0.1/internal",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "private" in resp.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# Engine health (public)
# ══════════════════════════════════════════════════════════════════════════════

class TestHealth:
    def test_root_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
        assert resp.headers["x-content-type-options"] == "nosniff"
        assert resp.headers["x-frame-options"] == "DENY"

    def test_engine_health(self, client):
        """Engine health is a protected sub-route."""
        token = _make_token()
        resp = client.get(
            "/v1/campaign/health",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["service"] == "engine"
