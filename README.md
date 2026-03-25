<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BrandMeld - AI-Powered Brand Voice Platform

> **Cloud Run Hackathon Project**: Enterprise-grade brand content generation with AI-powered voice analysis and quality auditing.

BrandMeld is a full-stack platform that helps creators and brands maintain authentic, consistent voice across all content. It combines Google Gemini AI for deep brand analysis with a sophisticated auditing system that acts as a "hard-gate" for quality control.

## 🏗️ Architecture

```
BrandMeld-CloudRunHackathon/
├── backend/                   # Python FastAPI (The "Brain")
│   ├── app/
│   │   ├── main.py            # API entry point
│   │   ├── services/          # Core business logic
│   │   │   ├── discovery.py   # Brand voice analysis (Gemini + Google Search)
│   │   │   ├── factory.py     # Content generation engine
│   │   │   └── auditor.py     # Quality auditing system
│   │   └── db/                # Firestore integration (future)
│   ├── Dockerfile             # Cloud Run deployment
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Environment template
└── frontend/                  # React + Vite Dashboard
    ├── src/
    │   ├── components/        # UI components
    │   ├── services/          # API client
    │   ├── data/              # Brand voice database
    │   ├── App.tsx            # Main application
    │   └── index.tsx          # Entry point
    ├── index.html
    ├── package.json
    └── .env.example           # Environment template
```

## 🚀 Core Features

### 1. **Brand Voice Discovery** (Level 1-3 Analysis)

- **Level 1**: Extract basic brand elements (colors, fonts, tone)
- **Level 2**: Deep voice analysis (sentence structure, perspective, keywords)
- **Level 3**: Competitive intelligence and trend analysis

**Technology**: Google Gemini 2.0 Flash + Google Search

### 2. **Content Factory**

Generate brand-aligned content at scale:

- Social posts (Twitter/X, LinkedIn)
- Marketing copy and taglines
- Blog outlines and newsletters
- Video scripts

### 3. **Voice Auditor** ("Hard-Gate")

The quality control system that validates:

- ✅ Brand voice alignment (0-100 score)
- ✅ Tone and style consistency
- ✅ Authenticity vs. generic AI content
- ✅ Specific rewrite suggestions

## 🛠️ Getting Started

### Prerequisites

- **Python 3.11+** (for backend)
- **Node.js 18+** (for frontend)
- **Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

### Backend Setup

1. Navigate to backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment:

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

4. Run the API server:

```bash
python -m uvicorn app.main:app --reload --port 8080
```

The API will be available at `http://localhost:8080`

**API Documentation**: http://localhost:8080/docs (Swagger UI)

### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment:

```bash
cp .env.example .env.local
# Edit .env.local if needed (defaults to http://localhost:8080)
```

4. Run the development server:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## 📡 API Endpoints

### Discovery Service

- `POST /api/discovery/analyze` - Analyze brand voice from URL/name
- `GET /api/discovery/health` - Service health check

### Factory Service

- `POST /api/factory/generate` - Generate content with brand voice
- `GET /api/factory/health` - Service health check

### Auditor Service

- `POST /api/auditor/audit` - Audit content against brand voice
- `GET /api/auditor/health` - Service health check

## ☁️ Cloud Run Deployment

### Deploy Backend API

```bash
cd backend

# Build and deploy to Cloud Run
gcloud run deploy brandmeld-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

### Deploy Frontend (Cloud Storage + CDN)

```bash
cd frontend

# Build production bundle
npm run build

# Deploy to Cloud Storage
gsutil -m rsync -r dist gs://brandmeld-dashboard

# Enable CDN and public access
gsutil iam ch allUsers:objectViewer gs://brandmeld-dashboard
```

Update `frontend/.env.production`:

```
VITE_API_URL=https://brandmeld-api-xxxxx.run.app
```

## 🧪 Testing the Integration

1. **Start both servers** (backend on :8080, frontend on :3000)

2. **Test brand analysis**:
   - Enter a URL or company name (e.g., "tesla.com" or "Elon Musk")
   - Click "Analyze Brand Voice"
   - The system will use Google Search + Gemini to extract voice profile

3. **Generate content**:
   - Use the analyzed voice or write your own
   - Enter a content request (e.g., "Write a tweet about AI")
   - Review generated draft

4. **Audit content**:
   - Switch to "Voice Auditor" tab
   - Paste existing content
   - Get alignment score and rewrite suggestions

## 🎨 Tech Stack

**Backend:**

- FastAPI (Python web framework)
- Google Gemini AI (2.0 Flash)
- Pydantic (data validation)
- Uvicorn (ASGI server)

**Frontend:**

- React 19
- TypeScript
- Vite (build tool)
- Tailwind CSS (styling)

**Deployment:**

- Google Cloud Run (backend)
- Cloud Storage + CDN (frontend)
- Cloud Firestore (future: user data)

## 📝 Environment Variables

### Backend (.env)

```bash
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8080
```

### Frontend (.env.local)

```bash
VITE_API_URL=http://localhost:8080
```

## 🤝 Contributing

This is a hackathon project. Feel free to fork and extend!

## 📄 License

MIT

---

**Built for the Google Cloud Run Hackathon** 🚀
