import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent

ACCIDENT_MODEL_PATH = PROJECT_DIR / "ml" / "models" / "checkpoints" / "best.pt"
DETECTOR_MODEL_PATH = PROJECT_DIR / "ml" / "models" / "checkpoints" / "yolov8n.pt"

CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
FPS = int(os.getenv("FPS", "30"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.90"))
CONSECUTIVE_FRAMES_REQUIRED = int(os.getenv("CONSECUTIVE_FRAMES_REQUIRED", "10"))
PRE_EVENT_SECONDS = int(os.getenv("PRE_EVENT_SECONDS", "5"))
POST_EVENT_SECONDS = int(os.getenv("POST_EVENT_SECONDS", "5"))

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1").strip()
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "crashvision-ai-337169763677-ap-south-1-an").strip()
S3_MODEL_BUCKET_NAME = os.getenv("S3_MODEL_BUCKET_NAME", "crashvision-models-337169763677-ap-south-1").strip()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "crashvision")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

MLFLOW_TRACKING_URI = os.getenv(
    "MLFLOW_TRACKING_URI",
    f"sqlite:///{PROJECT_DIR / 'mlflow' / 'mlflow.db'}"
).strip()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "crashvision_super_secret_jwt_key_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

PRESIGNED_URL_EXPIRES = int(os.getenv("PRESIGNED_URL_EXPIRES", "3600"))

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

FFMPEG_AVAILABLE = shutil.which("ffmpeg") is not None

# Startup validations
ACCIDENT_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
Path(BASE_DIR / "recordings").mkdir(parents=True, exist_ok=True)
