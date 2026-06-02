<div align="center">
  <img src="./assets/Logo.png" alt="BrandMeld Logo" width="400" />
</div>

# BrandMeld — Autonomous AI Growth OS

BrandMeld has evolved from a traditional SaaS tool into a category-defining, **autonomous AI growth operating system**. Built for founders and creators, it transforms how you approach personal branding by acting as your dedicated growth engine — featuring a premium dark-mode interface, an outcome-first workflow layout, and unified AI intelligence.

<div align="center">
  <img src="./assets/Dashboard.png" alt="BrandMeld Dashboard" width="800" />
</div>

---

## 🚀 The AI Growth Engine

### 1. Outcome-First Workflow Navigation
No more navigation clutter or dead stubs. BrandMeld features a streamlined, 5-step lifecycle designed to move you from raw inspiration to published posts in minutes:
* **Discover**: Gather weekly performance briefs, prompt insights, and AI recommendations.
* **Plan**: Create, configure, and approve campaign ideas using your unique Brand DNA.
* **Create**: Fine-tune generated platform drafts inside a unified editor with version history.
* **Publish**: Schedule campaigns, dispatch live to social networks, and monitor post queues.
* **Learn**: Access structured performance telemetry, SEO keywords, and competitor insights.

### 2. Premium "Dark Mode" Design
A high-end, sophisticated user interface designed for maximum focus and low friction. The customized design system ensures that everything from your analytics dashboard to your content editor feels responsive, premium, and distraction-free.

### 3. AI-Native Content Creation
Generate platform-specific content (LinkedIn posts, Twitter threads, newsletters) instantly. The engine runs your ideas through an internal auditing gate to ensure strict adherence to your unique "Brand DNA" — without the marketing busywork.

### 4. Shared Infrastructure & Performance
Our modularized backend architecture ensures fast page loads, clean separation of concerns, and reliable connection handling to external APIs (Google Gemini, Supabase, and LinkedIn).

---

## 🏗️ Architecture & Core Modules

The application is decoupled into a modern React frontend and a structured, modular FastAPI backend.

```
BrandMeld-CloudRunHackathon/
├── backend/                   # Python FastAPI
│   ├── app/
│   │   ├── core/              # Shared infrastructure (Gemini client, configuration)
│   │   ├── shared/            # Shared DB (Supabase) & unified FastAPI auth dependencies
│   │   ├── routers/           # Scoped API routing (analytics, publishing, prompts, settings, marketplace)
│   │   ├── services/          # Core domain logic (analytics, marketplace, prompts, publishing, engine)
│   │   └── main.py            # Application bootstrap & middleware routing
│   ├── Dockerfile             # Container configuration for Cloud Run
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React + Vite + TypeScript (Dark Mode)
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Isolated UI components (Auth, Dashboard)
│   │   ├── layout/            # App shell, Navbar, and Sidebar layout
│   │   ├── pages/             # App pages (DiscoverPage, DashboardPage, Content, PublishPage, LearnPage, SettingsPageNew)
│   │   └── App.tsx            # Application router and layout wrapping
│   └── index.html             # Entry point
└── deploy.ps1                 # Deployment script for Google Cloud Run
```

### Modular Refactor Overview (Phases 0-2)
* **Core Infrastructure (`app/core/`)**: Standardized Gemini client factory (`gemini.py`) with integrated backoff and automatic retry logic.
* **Shared Utilities (`app/shared/`)**: Unified Supabase DB client factory (`db.py`) and a shared FastAPI dependency helper (`deps.py`) to manage JWT authentication and request context.
* **Dead Code Pruned**: Legacy, unmaintained shims and dead controllers (such as `auditor.py`, `factory.py`, `imagen.py`, and `supabase.py`) have been removed to reduce bundle size and security risk.

---

## 🗺️ Information Architecture Redesign

The navigation layout has been refactored around the core user journey to allow absolute clarity:

| Step | Section | Route | Target Component | Former Stubs Redirected / Merged |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Discover** | `/discover` | `DiscoverPage` | `/dashboard` (home), AI Actions panel |
| **2** | **Plan** | `/plan` | `DashboardPage` | `/campaigns`, `/ai-studio`, `/dashboard/create` |
| **3** | **Create** | `/create` | `Content` | `/content` editor |
| **4** | **Publish** | `/publish` | `PublishPage` | `/history`, `/automations` |
| **5** | **Learn** | `/learn` | `LearnPage` | `/seo`, `/competitors`, `/analytics` |
| **-** | **Settings** | `/settings` | `SettingsPageNew` | `/settings`, `/marketplace/*`, OAuth settings |

---

## 📡 API Endpoints

The API is structured around modular, domain-specific prefixes under the `/v1` namespace:

### Campaign & Brand DNA
* `POST /v1/campaign/onboard` - Extracts detailed Brand DNA using Gemini from an input URL or text source.
* `POST /v1/campaign/plan` - Generates a multi-platform campaign outline and brief.
* `POST /v1/campaign/launch` - Generates drafts for designated channels and runs the self-audit loop.
* `POST /v1/campaign/edit` - Updates campaign draft files using AI-directed revision guidelines.
* `POST /v1/discovery` - Deprecated compatibility route for Brand DNA extraction.

### Analytics & Performance
* `GET /v1/analytics` - Fetches overall brand performance telemetry and metrics.
* `GET /v1/analytics/post/{post_id}` - Fetches detailed analytics tracking for a single post.

### Publishing & Integrations
* `POST /v1/publishing` - Publishes approved campaign drafts to connected platforms immediately.
* `POST /v1/publishing/schedule` - Schedules campaign drafts for automatic deployment.
* `GET /v1/publishing/connected` - Fetches list of active Oauth integrations (e.g. LinkedIn, Twitter).
* `GET /v1/connect/linkedin` - Generates secure authentication URL for LinkedIn connection.

### Marketplace & Distribution
* `GET /v1/marketplace/voices` - Lists available AI voice presets.
* `POST /v1/marketplace/voices/{voice_id}/fork` - Creates a personal fork of a public voice avatar.
* `GET /v1/weekly` - Retrieves the active weekly alignment prompt.
* `POST /v1/weekly/{prompt_id}/answer` - Submits answers to build or refine alignment preferences.

---

## 🛠️ Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Supabase Account** (For Auth database integration)
- **Google Gemini API Key**

### Environment Configuration

**1. Backend Config (`backend/.env`)**
Create `backend/.env` with:
```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL_ID=gemini-2.5-flash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=8080
```

**2. Frontend Config (`frontend/.env.local`)**
Create `frontend/.env.local` with:
```env
VITE_API_URL=http://localhost:8080
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Local Dev Startup

**Start Backend API:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8080
```

**Start Frontend Application:**
```bash
cd frontend
npm install
npm run dev
```
*Access the AI dashboard at `http://localhost:3000`*

---

## ☁️ Cloud Run Deployment

Deployment is automated via PowerShell script for GCP Cloud Run environments.

1. Ensure the `gcloud` CLI is installed and configured.
2. Run the deployment sequence from the root directory:
```powershell
.\deploy.ps1
```

---

**BrandMeld — The Personal Distribution Engine for People Who Hate Marketing.** 🚀
