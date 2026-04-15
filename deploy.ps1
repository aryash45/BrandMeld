# BrandMeld v2 — Personal Distribution Engine
# Cloud Run Deployment Script (Windows PowerShell)
#
# Usage:
#   .\deploy.ps1 -ProjectId my-gcp-project
#   .\deploy.ps1 -ProjectId my-gcp-project -Region europe-west1

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "your-gcp-project-id",

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1"
)

$ServiceName = "brandmeld-api"
$MinInstances = 0
$MaxInstances = 10
$Memory = "1Gi"   # bumped from 512Mi — engine.py uses async Playwright
$CpuCount = "1"
$Timeout = "120s" # brand scans can take ~40 s on cold start

Write-Host ""
Write-Host "  ⚡ BrandMeld v2 — Distribution Engine Deployment" -ForegroundColor Cyan
Write-Host "  =================================================" -ForegroundColor Cyan
Write-Host ""

# ── Preflight ──────────────────────────────────────────────────────────────────

if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "  ❌ gcloud CLI not found." -ForegroundColor Red
    Write-Host "     Install: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

if (!(Test-Path "backend/.env")) {
    Write-Host "  ⚠️  backend/.env not found — creating from .env.example..." -ForegroundColor Yellow
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Host "  ❗ Edit backend/.env with your real keys before continuing." -ForegroundColor Red
    exit 1
}

# ── Read env vars ──────────────────────────────────────────────────────────────

function Get-EnvVar([string]$file, [string]$key) {
    $line = Get-Content $file | Where-Object { $_ -match "^${key}=" } | Select-Object -First 1
    if (-not $line) { return "" }
    return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

$GeminiKey    = Get-EnvVar "backend/.env" "GEMINI_API_KEY"
$SupabaseUrl  = Get-EnvVar "backend/.env" "SUPABASE_URL"
$SupabaseKey  = Get-EnvVar "backend/.env" "SUPABASE_SERVICE_KEY"

if ([string]::IsNullOrEmpty($GeminiKey) -or $GeminiKey -eq "your_gemini_api_key_here") {
    Write-Host "  ❌ GEMINI_API_KEY is not set in backend/.env" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Gemini key found" -ForegroundColor Green
if ($SupabaseUrl) { Write-Host "  ✓ Supabase URL found" -ForegroundColor Green }
else               { Write-Host "  ⚠ SUPABASE_URL not set — Supabase features disabled" -ForegroundColor Yellow }

# ── Build env-vars string for Cloud Run ───────────────────────────────────────

$EnvVars = "GEMINI_API_KEY=$GeminiKey"
if ($SupabaseUrl)  { $EnvVars += ",SUPABASE_URL=$SupabaseUrl" }
if ($SupabaseKey)  { $EnvVars += ",SUPABASE_SERVICE_KEY=$SupabaseKey" }

# ── Set GCP project ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  📦 Project: $ProjectId   Region: $Region" -ForegroundColor Yellow
gcloud config set project $ProjectId --quiet

# ── Deploy backend ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  🔨 Deploying backend to Cloud Run..." -ForegroundColor Yellow

Push-Location backend

gcloud run deploy $ServiceName `
    --source . `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars $EnvVars `
    --min-instances $MinInstances `
    --max-instances $MaxInstances `
    --memory $Memory `
    --cpu $CpuCount `
    --timeout $Timeout `
    --quiet

$ExitCode = $LASTEXITCODE
Pop-Location

if ($ExitCode -ne 0) {
    Write-Host "  ❌ Backend deployment failed (exit $ExitCode)." -ForegroundColor Red
    exit $ExitCode
}

# ── Get service URL ───────────────────────────────────────────────────────────

$ServiceUrl = gcloud run services describe $ServiceName `
    --region $Region `
    --format "value(status.url)" `
    --quiet

Write-Host ""
Write-Host "  ✅ Backend deployed!" -ForegroundColor Green
Write-Host "  📍 URL: $ServiceUrl" -ForegroundColor Cyan

# ── Smoke test ────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  🩺 Running smoke test..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$ServiceUrl/health" -Method GET -TimeoutSec 15
    if ($health.status -eq "healthy" -and $health.version -eq "2.0.0") {
        Write-Host "  ✅ /health → OK (v$($health.version))" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ /health returned unexpected payload: $($health | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ Smoke test failed (service may still be warming up): $_" -ForegroundColor Yellow
}

# ── Frontend instructions ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Set VITE_API_URL in frontend/.env.production:"
Write-Host "         VITE_API_URL=$ServiceUrl" -ForegroundColor Cyan
Write-Host "    2. Build the frontend:"
Write-Host "         cd frontend && npm run build" -ForegroundColor Cyan
Write-Host "    3. Deploy dist/ to Firebase Hosting, Cloud Storage, or Vercel."
Write-Host ""
Write-Host "  🎉 BrandMeld v2 deployment complete!" -ForegroundColor Green
Write-Host ""
