# BrandMeld — Release-to-Revenue Intelligence

BrandMeld turns meaningful product releases into evidence-backed, human-approved customer actions.

```text
Release signal → Classification → Customer impact → Recommendation → Approval → Action → Outcome
```

The active implementation is a Rust API foundation for technical B2B SaaS, API, developer-tool, infrastructure, data, AI, and security products.

## Current status

- Rust API with health and readiness routes.
- Protected signal creation and retrieval under `/v2/signals`.
- Deterministic release classification with confidence, evidence, and review flags.
- Input validation and route-level tests.
- Postgres persistence, GitHub ingestion, customer-impact analysis, and the Next.js dashboard are next slices.

## Repository layout

```text
BrandMeld-CloudRunHackathon/
├── backend-rs/
│   ├── Cargo.toml
│   └── src/
│       ├── config.rs
│       ├── state.rs
│       ├── domain/
│       │   ├── signal.rs
│       │   └── classification.rs
│       └── http/
│           ├── auth.rs
│           ├── health.rs
│           └── signals.rs
├── frontend/              # Planned Next.js dashboard
└── assets/
```

## API

Health endpoints are public:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Process health |
| `GET` | `/ready` | Readiness check |

Signal endpoints require `Authorization: Bearer <BRANDMELD_API_TOKEN>`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/v2/signals` | Create a validated signal |
| `GET` | `/v2/signals/{id}` | Read a signal |
| `POST` | `/v2/signals/{id}/classify` | Classify a signal |
| `POST` | `/v2/signals/mock-github-release` | Create a development fixture |

## Run locally

Requirements: Rust stable toolchain.

```powershell
cd backend-rs
$env:BRANDMELD_API_TOKEN = "local-dev-token"
cargo run
```

The service listens on `0.0.0.0:$PORT` when `PORT` is set, or port `8081` otherwise. `BRANDMELD_HOST` and `BRANDMELD_PORT` remain supported for local overrides.

Example:

```powershell
$headers = @{ Authorization = "Bearer local-dev-token" }
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8081/v2/signals/mock-github-release `
  -Headers $headers
```

## Tests

```powershell
cd backend-rs
cargo fmt --check
cargo test
```

## Deployment

The Rust service supports Cloud Run’s `PORT` variable and binds to `0.0.0.0`. A container definition and deployment script still need to be added.

## Product direction

BrandMeld is not a generic social-posting tool. Its first wedge is helping technical B2B software teams understand which shipped changes matter, who they affect, and what approved customer or adoption action should follow.
