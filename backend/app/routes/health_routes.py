from fastapi import APIRouter
from app.config import (
    S3_BUCKET_NAME,
    MONGODB_DB,
    AWS_REGION,
    FFMPEG_AVAILABLE,
    ACCIDENT_MODEL_PATH,
    DETECTOR_MODEL_PATH,
)
from app.database import mongo_client
from app.storage import s3
from app.ai import llm
from app.camera import cap
from app.mlflow_tracker import get_mlflow_status

router = APIRouter(tags=["Health & Telemetry"])


@router.get("/")
def root():
    return {
        "message": "CrashVision AI API v2.0",
        "status": "running",
        "bucket": S3_BUCKET_NAME,
        "database": MONGODB_DB,
    }


@router.get("/api/health")
def health():
    mongo_ok = True
    try:
        mongo_client.admin.command("ping")
    except Exception:
        mongo_ok = False

    s3_ok = True
    s3_error = None
    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
    except Exception as exc:
        s3_ok = False
        s3_error = str(exc)

    mlflow_info = get_mlflow_status()

    return {
        "status": "ok",
        "camera_open": bool(cap is not None and cap.isOpened()),
        "groq_configured": llm is not None,
        "mongodb": mongo_ok,
        "s3": s3_ok,
        "s3_error": s3_error,
        "s3_bucket": S3_BUCKET_NAME,
        "aws_region": AWS_REGION,
        "ffmpeg_available": FFMPEG_AVAILABLE,
        "accident_model": ACCIDENT_MODEL_PATH.name,
        "detector_model": DETECTOR_MODEL_PATH.name,
        "mlflow": mlflow_info,
    }


@router.get("/api/mlflow/status")
def mlflow_status():
    return get_mlflow_status()
