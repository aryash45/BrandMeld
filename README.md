<div align="center">
  <img src="./assets/Logo.png" alt="BrandMeld Logo" width="400" />
</div>

# BrandMeld  — Autonomous AI Growth OS

BrandMeld has evolved from a traditional SaaS tool into a category-defining, **autonomous AI growth operating system**. Built for founders and creators, it transforms how you approach personal branding by acting as your dedicated growth engine — featuring a premium dark-mode interface, an AI Action Center, and daily intelligence briefings.

<div align="center">
  <img src="./assets/Dashboard.png" alt="BrandMeld Dashboard" width="800" />
</div>

---

## 🚀 The AI Growth Engine

### 1. AI Action Center & Daily Briefings
Start your day with an AI-generated intelligence briefing. The system analyzes your performance, tracks your SEO metrics, and provides an actionable daily checklist of tasks (e.g., "Repurpose viral thread", "Fix declining SEO keywords").

### 2. Premium "Dark Mode" Design
A high-end, sophisticated user interface designed for maximum focus and low friction. Our new design system ensures that everything from your analytics dashboard to your content editor feels responsive, premium, and distraction-free.

### 3. AI-Native Content Creation
Generate platform-specific content (LinkedIn posts, Twitter threads, newsletters) instantly. The engine runs your ideas through an internal auditing gate to ensure strict adherence to your unique "Brand DNA" — without the marketing busywork.

### 4. Recommendation-First Workflows
Say goodbye to blank-page syndrome. BrandMeld proactively suggests content gaps, competitor analysis insights, and repurposing opportunities based on what’s actually working for you.

## 🏗️ Architecture

The application is decoupled into a modern React frontend and a robust FastAPI backend.

```
BrandMeld-CloudRunHackathon/
├── backend/                   # Python FastAPI
│   ├── app/
│   │   ├── main.py            # API Route Configuration
│   │   ├── services/
│   │   │   └── engine.py      # Core Gemini generation & self-auditing logic
│   ├── Dockerfile             # Container configuration for Cloud Run
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React + Vite + Tailwind CSS (Dark Mode)
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Isolated UI components (Auth, Dashboard)
│   │   ├── pages/             # App pages and views
│   │   └── App.tsx            # Main application router
│   └── index.html             # Entry point
└── deploy.ps1                 # Deployment script for Google Cloud Run
```

## 🛠️ Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Supabase Account** (For Auth integration)
- **Google Gemini API Key**

### Environment Configuration

**1. Backend Config (`backend/.env`)**
```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL_ID=gemini-2.5-flash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PORT=8080
```

**2. Frontend Config (`frontend/.env.local`)**
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

## ☁️ Cloud Run Deployment

Deployment is automated via PowerShell script for GCP Cloud Run environments.

1. Ensure the `gcloud` CLI is installed and configured.
2. Run the deployment sequence from the root directory:
```powershell
.\deploy.ps1
```

## 📡 API Endpoints

All core brand logic has been consolidated under `/v1/campaign/*` endpoints:

- `POST /v1/campaign/onboard` - Extracts detailed Brand DNA using Gemini from an input URL/text.
- `POST /v1/campaign/launch` - Generates payload targeted for specific platforms and natively triggers the internal self-audit loop.
- `GET /health` - API readiness check.

---

**BrandMeld — The Personal Distribution Engine for People Who Hate Marketing.** 🚀
