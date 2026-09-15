# CrashVision AI

> Real-time highway accident detection, AWS S3 evidence vault, MLflow model tracking, and LangChain LLM incident intelligence.

CrashVision AI monitors live video streams, detects traffic incidents using custom YOLOv8 classification and object detection, automatically archives video/image evidence to private AWS S3, logs experiment telemetry to MLflow, and provides an AI conversational assistant with JWT user authentication.

---

## Key Features

- **Real-time YOLOv8 Vision**: Dual model pipeline running object detection (`yolov8n.pt`) and accident classification (`best.pt`).
- **AWS S3 Evidence Vault**: Automatic pre-roll/post-roll H.264 video encoding & frame capture uploaded directly to S3 with presigned URLs.
- **MLflow Telemetry Tracking**: Logs metrics (`confidence`, `objects_count`), parameters, and AI report artifacts to MLflow tracking server (`mlflow.db`).
- **LangChain + Groq LLM Intelligence**: Automated incident report generation and persistent multi-turn conversational AI QA assistant.
- **JWT User Authentication**: Secure operator registration and login using PBKDF2 HMAC password hashing and JWT tokens.
- **Futuristic Aceternity Hero UI**: Interactive landing dashboard, live WebSocket telemetry stream, incident hub, and diagnostic stats.
- **Modular Asynchronous FastAPI Core**: Refactored package architecture (`backend/app/`) with graceful MongoDB connection lifespan management.

---

## Architecture

```text
Camera Stream → OpenCV → YOLOv8 Object + Accident Inference
                       → Buffer Pre/Post-roll Evidence
                       → AWS S3 Private Vault (Presigned URLs)
                       → MongoDB Record + User Collections
                       → LangChain + Groq LLM Report & Chat
                       → MLflow Experiment Telemetry Logging
                       → React 19 Aceternity Dashboard
```

---

## Project Structure

```text
accidentProject/
├── backend/
│   ├── main.py              # Uvicorn launcher entry point
│   ├── .env                 # AWS, MongoDB, Groq & API secrets
│   └── app/
│       ├── main_app.py      # FastAPI application & lifespan manager
│       ├── config.py        # Centralized settings & environment loader
│       ├── database.py      # MongoDB collections & demo auto-seeder
│       ├── storage.py       # AWS S3 upload & presigned URL generator
│       ├── ml_models.py     # YOLO object detector & classifier models
│       ├── ai.py            # LangChain + ChatGroq report & chat chains
│       ├── camera.py        # OpenCV capture, video encoding & frame pipeline
│       ├── auth.py          # PBKDF2 hashing, JWT creation & verification
│       ├── mlflow_tracker.py# MLflow run, metric, parameter & artifact logger
│       └── routes/          # Auth, records, monitor & health API routes
├── frontend/
│   └── src/
│       ├── App.tsx          # Main layout & state orchestrator
│       ├── components/
│       │   ├── home/        # HeroSection landing view
│       │   ├── auth/        # AuthModal login & register dialog
│       │   ├── monitor/     # LiveMonitoring video feed
│       │   └── incidents/   # IncidentList & IncidentDetails with AI Chat
│       └── hooks/           # useAuth, useIncidents, useWebSocketMonitor
├── ml/                      # YOLO model checkpoints (best.pt, yolov8n.pt)
└── mlflow/                  # MLflow experiment tracking database & runs
```

---

## REST API & WebSockets

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status & bucket info |
| `GET` | `/api/health` | Comprehensive health check (MongoDB, S3, MLflow) |
| `POST` | `/api/auth/register` | Register new security operator account |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT bearer token |
| `GET` | `/api/auth/me` | Fetch current user profile |
| `POST` | `/api/start` | Start live camera monitoring loop |
| `POST` | `/api/stop` | Stop live camera monitoring loop |
| `GET` | `/api/records` | List incident records with filters & pagination |
| `GET` | `/api/records/{id}` | Get detailed incident record & S3 presigned URLs |
| `POST` | `/api/records/{id}/chat` | Send query to LangChain LLM incident assistant |
| `GET` | `/api/mlflow/status` | Query MLflow experiment tracking telemetry |
| `WS` | `/ws/monitor` | Real-time WebSocket annotated frame stream |

---

## Configuration (`backend/.env`)

```env
# AI Intelligence
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b

# Camera & Detection Thresholds
CAMERA_INDEX=0
FPS=30
CONFIDENCE_THRESHOLD=0.90
CONSECUTIVE_FRAMES_REQUIRED=10
PRE_EVENT_SECONDS=5
POST_EVENT_SECONDS=5

# AWS S3 Storage Vault
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=crashvision-ai-337169763677-ap-south-1-an
PRESIGNED_URL_EXPIRES=3600

# MongoDB Database
MONGODB_URI=mongodb+srv://user:pass@cluster0.mongodb.net/
MONGODB_DB=crashvision

# MLflow Experiment Tracking
MLFLOW_TRACKING_URI=sqlite:///mlflow/mlflow.db

# API & Security
API_HOST=0.0.0.0
API_PORT=8000
JWT_SECRET_KEY=crashvision_super_secret_jwt_key_2026
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

## Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ / npm
- MongoDB instance (local or Atlas)
- AWS S3 bucket with IAM access credentials

### 2. Backend Setup & Run
```bash
cd backend
..\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API runs on `http://localhost:8000` (Docs: `http://localhost:8000/docs`).

### 3. Frontend Setup & Run
```bash
cd frontend
npm install
npm run dev
```
Dashboard opens on `http://localhost:5173`.

---

## License

Developed by the CrashVision AI Engineering Team.
