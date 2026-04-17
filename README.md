# BrandMeld

AI-powered brand voice analysis and content generation platform.

BrandMeld is a full-stack content distribution platform designed to help founders and creators maintain a consistent personal brand. It utilizes Google Gemini Flash to extract a user's unique "Brand DNA" from their existing content, and then generates new, platform-specific content (Twitter/LinkedIn) that goes through an internal auditing gate to ensure strict adherence to that voice.

---

## 🚀 Core Features

### 1. Brand Identity Extraction
Provide a website or text sample. The system uses the **Gemini Flash** model family to deconstruct syntax, tone, pacing, and vocabulary, generating a deterministic voice profile for future content.

### 2. The Distribution Engine
Generate platform-specific content (e.g., LinkedIn posts, Twitter threads, newsletters) by passing prompts through your customized brand-voice model.

### 3. Native Self-Correction & Auditing
All generated content is automatically routed through an internal Auditor. Output is scored (0-100) against your extracted Brand DNA. If the content fails the threshold, the system self-corrects and rewrites the content before returning it to the user.

## 🏗️ Architecture

The application is built entirely as a decoupling of a React single-page frontend and a FastAPI backend. Authentication state is handled via Supabase Auth.

```
BrandMeld-CloudRunHackathon/
├── backend/                   # Python FastAPI
│   ├── app/
│   │   ├── main.py            # API Route Configuration
│   │   ├── services/
│   │   │   └── engine.py      # Core Gemini generation & self-auditing logic
│   ├── Dockerfile             # Container configuration for Cloud Run
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/        # Isolated UI components (Auth, Dashboard)
│   │   ├── services/          # Supabase client & Backend API hooks
│   │   └── App.tsx            # Main application router
│   └── index.html             # Entry point
└── deploy.ps1                 # Deployment script for Google Cloud Run
```

## 🛠️ Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Supabase Account** (For Auth integration)
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

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
*Access the dashboard at `http://localhost:3000`*

## ☁️ Cloud Run Deployment

Deployment is automated via PowerShell script for GCP Cloud Run environments.

1. Ensure the `gcloud` CLI is installed and configured with your target GCP project.
2. Run the deployment sequence from the root directory:
```powershell
.\deploy.ps1
```
The script will build the Dockerfile and deploy the backend service automatically.

## 📡 Key API Routes

All core brand logic has been consolidated under `/v1/campaign/*` logic endpoints:

- `POST /v1/campaign/onboard` - Extracts detailed Brand DNA using Gemini from an input URL/text.
- `POST /v1/campaign/launch` - Generates payload targeted for specific platforms and natively triggers the internal self-audit loop.
- `GET /health` - API readiness check.

---

**Built for People Who Hate Marketing** 🚀
