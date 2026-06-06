# BrandMeld — Security Audit Report

> **Auditor:** Antigravity  
> **Date:** 2026-06-06  
> **Scope:** JWT implementation · Middleware · Auth bypasses · Secrets management · Authorization checks  
> **Reference:** OWASP Top 10 (2021)  
> **Constraint:** No auth rewrite · No Convex migration

---

## Severity Legend

| Priority | Meaning |
|---|---|
| **P0 Critical** | Exploitable in production today — fix before shipping |
| **P1 Important** | Exploitable under specific conditions or as part of a chain — fix soon |
| **P2 Nice-to-have** | Defense-in-depth / hardening — fix in next sprint |

---

## P0 — Critical

---

### [P0-1] Auth Middleware Completely Disabled in Dev Mode

**OWASP:** A07:2021 — Identification and Authentication Failures  
**File:** [`backend/app/main.py:149–156`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

**Vulnerable code:**
```python
# Dev mode: no verifier configured → let requests through
if not jwt_secret and auth_client is None:
    logger.warning(
        "No Supabase token verifier configured — auth middleware is DISABLED. "
        "Set SUPABASE_JWT_SECRET for production."
    )
    request.state.user_id = "dev-user"
    return await call_next(request)
```

**The bug:** If `SUPABASE_JWT_SECRET` and `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are both missing, **every single request bypasses authentication** and is treated as `user_id = "dev-user"`. This could happen in production if env vars are accidentally unset (e.g., misconfigured Cloud Run deployment). Attackers reaching the service without those env vars get full API access as a shared ghost user.

**Exploitation:** Drop both env vars → all routes become public.

**Remediation:**
```python
# Replace the silent passthrough with a hard fail in production
from app.config import get_settings

if not jwt_secret and auth_client is None:
    settings = get_settings()
    if settings.is_production:
        logger.critical("SUPABASE_JWT_SECRET not configured in production — rejecting all requests")
        return JSONResponse(
            status_code=503,
            content={"detail": "Service not properly configured."},
        )
    # Dev-only fallback
    logger.warning("Auth disabled — dev mode only")
    request.state.user_id = "dev-user"
    return await call_next(request)
```

---

### [P0-2] LinkedIn OAuth Callback Accepts `user_id` from URL Query Parameter

**OWASP:** A01:2021 — Broken Access Control  
**File:** [`backend/app/routers/publishing.py:147–151`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/routers/publishing.py)

**Vulnerable code:**
```python
# We need user_id from state/session — for now read from query param (dev)
# In production, encode user_id in state token
user_id = request.query_params.get("user_id", "")
if not user_id or not s.supabase_url:
    raise ValueError("Cannot determine user_id from callback")

sb.table("connected_accounts").upsert({
    "user_id": user_id,
    ...
}).execute()
```

**The bug:** The `/v1/auth/linkedin/callback` route is in `_PUBLIC_PATHS` (no JWT required — correct for OAuth callbacks). However, the `user_id` that determines which account gets the LinkedIn token is taken directly from `?user_id=` in the URL. Any attacker who knows a victim's user UUID can:
1. Initiate their own LinkedIn OAuth flow
2. After consent, tamper the callback URL to `?user_id=<victim_uuid>`
3. LinkedIn token is stored under the victim's account

This is a classic **OAuth account-takeover vector**.

**Exploitation:**
```
GET /v1/auth/linkedin/callback?code=ATTACKER_CODE&state=X&user_id=VICTIM_UUID
```

**Remediation:**  
Encode `user_id` into the `state` parameter at OAuth initiation time (cryptographically signed):
```python
# In connect_linkedin_start():
import hmac, hashlib, base64, json, os

def build_state_token(user_id: str) -> str:
    payload = json.dumps({"uid": user_id}).encode()
    sig = hmac.new(os.getenv("STATE_SECRET", "").encode(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + b"." + sig).decode()

def verify_state_token(token: str) -> str:
    raw = base64.urlsafe_b64decode(token.encode())
    payload, sig = raw.rsplit(b".", 1)
    expected = hmac.new(os.getenv("STATE_SECRET", "").encode(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid state token")
    return json.loads(payload)["uid"]
```
Then in the callback, call `user_id = verify_state_token(state)` — remove `request.query_params.get("user_id")` entirely.

---

### [P0-3] `/v1/campaign/plan`, `/v1/campaign/launch`, `/v1/campaign/edit` Have No Authorization — No User Isolation

**OWASP:** A01:2021 — Broken Access Control  
**Files:**  
- [`backend/app/services/engine.py:523–582, 585–616`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/services/engine.py)

**Vulnerable code:**
```python
@router.post("/plan", response_model=CampaignPlanResponse)
async def plan_campaign(req: CampaignPlanRequest):
    # No user_id, no request object
    ...

@router.post("/launch", response_model=CampaignLaunchResponse)
async def launch_campaign(req: CampaignLaunchRequest):
    # No user_id, no request object
    ...

@router.post("/edit", response_model=EditResponse)
async def edit_draft(req: EditRequest):
    # No user_id, no request object
    ...
```

**The bug:** These three routes accept `Request` objects but **never call `get_user_id(request)`**. The JWT middleware does run, so a token *is* required to pass auth — but the handlers never verify which user is acting, and they accept arbitrary `brand_voice`, `brand_dna`, and `content` from the request body with no per-user validation. Combined with P0-1, if auth is disabled, these become fully unauthenticated Gemini API abuse vectors with no attribution.

Additionally, `POST /v1/campaign/onboard` (line 619) accepts a `user_id` field in the **request body** (`OnboardRequest.user_id: str | None`) and uses it to write to Supabase:
```python
row = {**dna.model_dump(), "url": req.url, "user_id": req.user_id}
sb.table("brand_dna").upsert(row, on_conflict="url").execute()
```
An authenticated user can supply any arbitrary `user_id` to write brand DNA under any other user's account.

**Remediation:**
1. Add `request: Request` parameter to `plan_campaign`, `launch_campaign`, and `edit_draft`; call `user_id = get_user_id(request)` at the top.
2. Remove `user_id` from `OnboardRequest` and derive it from the JWT only:
```python
@router.post("/onboard", response_model=OnboardResponse)
async def onboard_brand(req: OnboardRequest, request: Request):
    user_id = get_user_id(request)   # ← always from JWT
    ...
    row = {**dna.model_dump(), "url": req.url, "user_id": user_id}
```

---

### [P0-4] `/v1/discovery` Is Unauthenticated and Writable

**OWASP:** A01:2021 — Broken Access Control  
**File:** [`backend/app/main.py:244–265`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

**Vulnerable code:**
```python
@app.post("/v1/discovery", tags=["discovery (deprecated)"])
async def discover(url: str):
    """Legacy discovery shim — delegates to engine._extract_brand_dna."""
```

**The bug:** This deprecated route:
- Has **no `Request` parameter** → the JWT middleware runs but `user_id` is never asserted
- Accepts a `url` query parameter and triggers a Playwright browser + Gemini API call with zero authentication
- Writes to Supabase via `_SupabaseService` (references a deleted class — will crash at runtime)

Any anonymous caller can use this to:
1. Trigger unbounded Gemini API usage (cost amplification)
2. Trigger server-side SSRF scans using the Playwright browser pointed at internal URLs (partially mitigated by `_normalize_url` — see P1-1)

**Remediation:**  
Either remove the route entirely (it references a deleted class so it's broken), or gate it properly:
```python
@app.post("/v1/discovery", tags=["discovery (deprecated)"])
async def discover(url: str, request: Request):
    user_id = get_user_id(request)  # enforces auth
    ...
```

---

## P1 — Important

---

### [P1-1] SSRF Mitigation Is Incomplete (DNS Rebinding)

**OWASP:** A10:2021 — Server-Side Request Forgery (SSRF)  
**File:** [`backend/app/services/engine.py:74–123`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/services/engine.py)

**The issue:** `_enforce_public_url()` resolves the hostname via `socket.getaddrinfo()` before Playwright/`urlopen` fetches the URL. This is a **time-of-check-time-of-use (TOCTOU)** gap:

1. Attacker registers `evil.com` → points to a public IP at check time → passes validation
2. DNS TTL expires, attacker updates record to `169.254.169.254` (GCP metadata) between check and fetch
3. Playwright fetches the metadata endpoint

GCP Cloud Run metadata is at `http://metadata.google.internal/computeMetadata/v1/` and can expose service account tokens.

**Remediation:**
- Pass the resolved IP directly to Playwright instead of the hostname (force-resolve at the application level).
- Add an IP blocklist check *inside* the Playwright request interception (not just at DNS resolution time):
```python
# In _capture_screenshot(), add Playwright network interception
page.on("request", lambda req: block_if_private(req))
```
- Block `169.254.0.0/16`, `100.64.0.0/10` (GCP internal ranges) explicitly.

---

### [P1-2] JWT `sub` Claim Decoded Without Signature Verification

**OWASP:** A07:2021 — Identification and Authentication Failures  
**File:** [`backend/app/main.py:185–188`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

**Vulnerable code:**
```python
elif auth_client is not None and await _verify_supabase_token(token):
    # Decode without verification just to extract sub
    payload = pyjwt.decode(token, options={"verify_signature": False})
    user_id = payload.get("sub")
```

**The issue:** Even though `_verify_supabase_token` runs first (calls Supabase to validate the token), the actual `sub` claim is extracted from a **second, unverified decode**. This creates a subtle attack surface:
- If `_verify_supabase_token` returns `True` for a valid token `T`, but the `Authorization` header is swapped to a different (possibly forged) token `T'` between the two calls (race/proxy injection scenario), `user_id` is extracted from `T'` without verification.
- The `sub` claim in the unverified decode can be anything.

**Remediation:**  
The Supabase `auth_client.get_user(token)` call already returns the user object — extract `sub` from it directly:
```python
user_response = await asyncio.to_thread(auth_client.get_user, token)
if user_response and user_response.user:
    user_id = user_response.user.id   # ← authoritative, no second decode needed
```

---

### [P1-3] `user_id = user_id or "unknown"` Allows Data Writes Under Ghost Identity

**OWASP:** A01:2021 — Broken Access Control  
**File:** [`backend/app/main.py:201`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

**Vulnerable code:**
```python
request.state.user_id = user_id or "unknown"
```

**The issue:** If JWT decoding succeeds but the `sub` claim is missing or empty (which is valid per the JWT spec), `user_id` becomes the string `"unknown"`. Any Supabase write (`published_posts`, `brand_dna`, `user_preferences`, etc.) will then store data under the literal key `"unknown"` — meaning multiple users with misconfigured tokens could read each other's data.

**Remediation:**
```python
if not user_id:
    return JSONResponse(
        status_code=401,
        content={"detail": "Token missing subject claim."},
        headers=cors_headers,
    )
request.state.user_id = user_id
```

---

### [P1-4] `ENCRYPTION_KEY` Is Not Documented in `.env.example` — Tokens Stored in Plaintext When Unset

**OWASP:** A02:2021 — Cryptographic Failures  
**Files:**  
- [`backend/app/services/publishing_service.py:43–60`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/services/publishing_service.py)
- [`backend/.env.example`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/.env.example)

**Vulnerable code:**
```python
def encrypt_token(plain: str) -> str:
    f = _fernet()
    if not f:
        return plain      # ← silently stores plaintext if key not set
```

**The issue:** The `.env.example` file includes a comment referencing the Fernet key but **does not include `ENCRYPTION_KEY=` as a required variable**. If a developer copies `.env.example` as-is, OAuth access tokens are stored in plaintext in the `connected_accounts` Supabase table. A single database leak exposes all LinkedIn access tokens.

**Remediation:**
1. Add `ENCRYPTION_KEY=` to `.env.example` with generation instructions (already in a comment — promote it to a real line)
2. Make the app fail at startup if `ENCRYPTION_KEY` is missing in production:
```python
# In config.py or app startup
if settings.is_production and not settings.encryption_key:
    raise RuntimeError("ENCRYPTION_KEY must be set in production to protect OAuth tokens")
```
3. Change `encrypt_token` to raise instead of silently falling back:
```python
def encrypt_token(plain: str) -> str:
    f = _fernet()
    if not f:
        raise RuntimeError("ENCRYPTION_KEY not configured — refusing to store token in plaintext")
    return f.encrypt(plain.encode()).decode()
```

---

### [P1-5] OAuth CSRF — `state` Parameter Is Not Verified at Callback

**OWASP:** A03:2021 — Injection / A01:2021 — Broken Access Control  
**Files:**  
- [`backend/app/routers/publishing.py:116–122`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/routers/publishing.py) (initiation)
- [`backend/app/routers/publishing.py:129–171`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/routers/publishing.py) (callback)

**The issue:**
```python
# Initiation
state = secrets.token_urlsafe(16)
auth_url = build_linkedin_auth_url(state)
return {"auth_url": auth_url, "state": state}

# Callback — state is accepted but NEVER validated
async def linkedin_callback(code: str, state: str, request: Request):
    # state parameter is received but ignored completely
    token_data = await exchange_linkedin_code(code)
```

The `state` value is generated and returned to the client but never stored server-side. At callback time, the `state` parameter is accepted from the URL but not compared against anything. This means the classic **OAuth CSRF attack** works: an attacker can trick a user's browser into completing an OAuth flow they didn't initiate.

**Remediation:**  
Store state in a short-lived server-side cache (e.g., Redis or Supabase with TTL) during initiation, then verify at callback:
```python
# Initiation: save in DB with 10 min TTL
sb.table("oauth_state").insert({"state": state, "user_id": user_id, "expires_at": ...}).execute()

# Callback: verify before proceeding
r = sb.table("oauth_state").select("user_id").eq("state", state).maybe_single().execute()
if not r.data:
    raise HTTPException(400, "Invalid or expired OAuth state")
user_id = r.data["user_id"]
sb.table("oauth_state").delete().eq("state", state).execute()
```

---

### [P1-6] Internal Exception Details Leaked to API Clients

**OWASP:** A05:2021 — Security Misconfiguration  
**File:** [`backend/app/services/engine.py:537, 576, 616, 630`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/services/engine.py)

**Vulnerable code (multiple locations):**
```python
raise HTTPException(status_code=500, detail=f"Campaign planning failed: {exc}") from exc
raise HTTPException(status_code=500, detail=f"Campaign generation failed: {exc}") from exc
raise HTTPException(status_code=500, detail=f"Edit failed: {exc}") from exc
raise HTTPException(status_code=500, detail=f"Brand discovery failed: {exc}") from exc
```

**The issue:** Raw Python exception messages are forwarded to the client. These may contain:
- Internal file paths (`/app/services/engine.py line 537`)
- Supabase connection strings or table names on DB errors
- Gemini API error payloads that reference internal model IDs or quota details
- Stack traces with infrastructure details

**Remediation:**  
Log the full exception server-side and return a generic message:
```python
except Exception as exc:
    logger.error("Campaign planning failed for request: %s", exc, exc_info=True)
    raise HTTPException(status_code=500, detail="Campaign planning failed. Please try again.") from exc
```

---

### [P1-7] No Rate Limiting on Any Endpoint

**OWASP:** A05:2021 — Security Misconfiguration  
**Files:** All routers — none implement rate limiting.

**The issue:** There is zero rate limiting across the entire API. Specific risks:
- `POST /v1/campaign/launch` — Each call makes multiple parallel Gemini API calls. An attacker can run up your Gemini bill in seconds.
- `POST /v1/campaign/onboard` — Launches Playwright browser + Gemini vision. Expensive per call.
- `GET /v1/campaign/watchdog` — Unauthenticated (same as P0-4) and makes network + Gemini calls.
- `POST /v1/score` — Calls Gemini for each request.

**Remediation:**  
Add `slowapi` (FastAPI rate limiting library):
```python
# pip install slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# On expensive endpoints:
@router.post("/launch")
@limiter.limit("10/minute")
async def launch_campaign(request: Request, req: CampaignLaunchRequest):
    ...
```

---

## P2 — Nice-to-Have

---

### [P2-1] Missing `Content-Security-Policy` Header

**OWASP:** A05:2021 — Security Misconfiguration  
**File:** [`backend/app/main.py:124–133`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

The security headers middleware sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` — but is missing **Content-Security-Policy**.

**Remediation:**
```python
response.headers.setdefault(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self' https://*.supabase.co; script-src 'self';"
)
```

---

### [P2-2] `allow_methods=["*"]` and `allow_headers=["*"]` in CORS

**OWASP:** A05:2021 — Security Misconfiguration  
**File:** [`backend/app/main.py:114–120`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],      # ← too permissive
    allow_headers=["*"],      # ← too permissive
)
```

**Remediation:**
```python
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
```

---

### [P2-3] `get_user_id` Falls Back to `"anonymous"` Without Raising

**OWASP:** A01:2021 — Broken Access Control  
**File:** [`backend/app/shared/deps.py:27–28`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/shared/deps.py)

```python
def get_user_id_from_request(request: Request) -> str:
    return getattr(request.state, "user_id", "anonymous")
```

If the middleware fails to attach `user_id` for any reason, all downstream DB queries run under the literal string `"anonymous"` without any error. This is a silent failure mode.

**Remediation:**
```python
def get_user_id_from_request(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid
```

---

### [P2-4] `Supabase_ANON_KEY` Used as Fallback for Service Role in Backend

**OWASP:** A02:2021 — Cryptographic Failures  
**File:** [`backend/app/shared/db.py:34–37`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/shared/db.py)

```python
key = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    or os.getenv("SUPABASE_ANON_KEY", "").strip()
)
```

The backend should **always** use the service role key — it bypasses Row Level Security (RLS). The anon key is subject to RLS and intended for client-side use. If only the anon key is set in a misconfigured environment, the backend silently runs with degraded permissions and unpredictable data access behavior.

**Remediation:**  
Remove the anon key fallback. Raise a startup error if `SUPABASE_SERVICE_ROLE_KEY` is not set:
```python
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
if not key:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY must be set for backend DB access")
```

---

### [P2-5] `platform` Query Parameter Not Sanitized Before Supabase Filter

**OWASP:** A03:2021 — Injection  
**File:** [`backend/app/routers/analytics.py:28, 56`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/routers/analytics.py)

```python
platform: Optional[str] = Query(default=None, description="Filter by platform")
...
if platform:
    q = q.eq("platform", platform)
```

The `platform` value is passed directly into a Supabase `.eq()` filter with no allowlist validation. Supabase uses parameterized queries so SQL injection is not a direct risk, but it could result in unexpected query behavior or data enumeration if someone passes unusual values (e.g., empty string, null bytes, Unicode manipulation).

**Remediation:**
```python
VALID_PLATFORMS = {"twitter", "linkedin", "instagram", "newsletter"}
platform: Optional[str] = Query(default=None, pattern=f"^({'|'.join(VALID_PLATFORMS)})$")
```

---

### [P2-6] `disconnect_account` Allows Disconnecting Any Platform String

**OWASP:** A01:2021 — Broken Access Control  
**File:** [`backend/app/routers/publishing.py:174–182`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/routers/publishing.py)

```python
@router.delete("/disconnect/{platform}")
async def disconnect_account(platform: str, request: Request):
    sb.table("connected_accounts").delete().eq("user_id", user_id).eq("platform", platform).execute()
    return {"platform": platform, "disconnected": True, "success": True}
```

The `platform` path parameter is not validated. While the `user_id` scoping prevents cross-user deletion, passing unexpected platform values could cause no-op deletions while returning `success: True`, misleading clients.

**Remediation:**
```python
VALID_PLATFORMS = {"linkedin", "twitter"}
if platform not in VALID_PLATFORMS:
    raise HTTPException(400, f"Invalid platform. Choose from: {VALID_PLATFORMS}")
```

---

### [P2-7] Supabase Service Role Key Used from `main.py` Auth Client

**OWASP:** A02:2021 — Cryptographic Failures  
**File:** [`backend/app/main.py:72–76`](file:///c:/Users/aryash/Downloads/Dsa/BrandMeld-CloudRunHackathon/backend/app/main.py)

```python
def _get_supabase_auth_key() -> str:
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )
```

For JWT validation via `auth_client.get_user(token)`, only the **anon key** is required — not the service role key. Using the service role key for token validation unnecessarily elevates the privilege of the auth client. If the auth client path is exploited, it operates with full RLS-bypass permissions.

**Remediation:**  
Use the anon key specifically for the auth client:
```python
def _get_supabase_auth_key() -> str:
    return os.getenv("SUPABASE_ANON_KEY", "").strip()
```

---

## Summary Table

| ID | Severity | OWASP Category | File | Issue |
|---|---|---|---|---|
| P0-1 | **Critical** | A07 — Auth Failures | `main.py:149` | Auth entirely bypassed when env vars missing |
| P0-2 | **Critical** | A01 — Broken Access Control | `publishing.py:149` | OAuth callback user_id from URL query param |
| P0-3 | **Critical** | A01 — Broken Access Control | `engine.py:523,547,585` | Plan/Launch/Edit routes have no user assertion; Onboard accepts user_id in body |
| P0-4 | **Critical** | A01 — Broken Access Control | `main.py:244` | `/v1/discovery` has no auth and triggers Gemini + Playwright |
| P1-1 | Important | A10 — SSRF | `engine.py:74` | DNS rebinding bypass on URL validation |
| P1-2 | Important | A07 — Auth Failures | `main.py:187` | JWT `sub` extracted without signature verification |
| P1-3 | Important | A01 — Broken Access Control | `main.py:201` | Missing `sub` maps all users to `"unknown"` key |
| P1-4 | Important | A02 — Cryptographic Failures | `publishing_service.py:43` | OAuth tokens stored in plaintext if ENCRYPTION_KEY missing |
| P1-5 | Important | A01 — Broken Access Control | `publishing.py:116,129` | OAuth state parameter never validated (CSRF) |
| P1-6 | Important | A05 — Security Misconfiguration | `engine.py:537,576,616` | Raw exception messages in 500 responses |
| P1-7 | Important | A05 — Security Misconfiguration | All routers | No rate limiting on any endpoint |
| P2-1 | Nice-to-have | A05 — Security Misconfiguration | `main.py:124` | No Content-Security-Policy header |
| P2-2 | Nice-to-have | A05 — Security Misconfiguration | `main.py:114` | CORS allows all methods and headers |
| P2-3 | Nice-to-have | A01 — Broken Access Control | `deps.py:27` | `get_user_id` silently returns `"anonymous"` |
| P2-4 | Nice-to-have | A02 — Cryptographic Failures | `db.py:34` | Anon key used as service role fallback |
| P2-5 | Nice-to-have | A03 — Injection | `analytics.py:28` | Platform query param not allowlisted |
| P2-6 | Nice-to-have | A01 — Broken Access Control | `publishing.py:174` | Platform path param not validated on disconnect |
| P2-7 | Nice-to-have | A02 — Cryptographic Failures | `main.py:72` | Service role key used where anon key sufficient |

---

## Recommended Fix Priority Order

```
Week 1 (before any production traffic):
  P0-1 → P0-2 → P0-3 → P0-4

Week 2:
  P1-2 → P1-3 → P1-4 → P1-5

Week 3:
  P1-6 → P1-7 (rate limiting takes the most setup)

Next sprint:
  P2-1 through P2-7 as part of regular hardening
```

---

*Generated by Antigravity · BrandMeld Security Audit v1.0 · OWASP Top 10 (2021)*
