import boto3
from pathlib import Path
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from ultralytics import YOLO

from app.config import (
    DETECTOR_MODEL_PATH,
    ACCIDENT_MODEL_PATH,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    S3_MODEL_BUCKET_NAME,
)


def sync_model_from_s3(s3_key: str = "models/checkpoints/best.pt") -> bool:
    """Download the latest retrained model from S3 model bucket if available."""
    try:
        s3_kwargs = {
            "region_name": AWS_REGION,
            "config": Config(
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
            ),
        }
        if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            s3_kwargs["aws_access_key_id"] = AWS_ACCESS_KEY_ID
            s3_kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY

        s3 = boto3.client("s3", **s3_kwargs)
        
        # Check if model object exists in S3 model bucket
        s3.head_object(Bucket=S3_MODEL_BUCKET_NAME, Key=s3_key)
        
        print(f"Downloading retrained model from s3://{S3_MODEL_BUCKET_NAME}/{s3_key}...")
        ACCIDENT_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        s3.download_file(S3_MODEL_BUCKET_NAME, s3_key, str(ACCIDENT_MODEL_PATH))
        print(f"S3 model sync complete: {ACCIDENT_MODEL_PATH}")
        return True
    except (BotoCoreError, ClientError) as exc:
        print(f"Note: S3 model sync skipped ({exc}). Using local checkpoint.")
        return False
    except Exception as exc:
        print("Model sync notice:", exc)
        return False


# Attempt S3 model sync before loading
sync_model_from_s3()

if not DETECTOR_MODEL_PATH.exists():
    raise FileNotFoundError(f"Object detector model not found: {DETECTOR_MODEL_PATH}")

if not ACCIDENT_MODEL_PATH.exists():
    raise FileNotFoundError(f"Accident classifier model not found: {ACCIDENT_MODEL_PATH}")

print(f"Loading object detector model: {DETECTOR_MODEL_PATH}")
detector = YOLO(str(DETECTOR_MODEL_PATH))

print(f"Loading accident classifier model: {ACCIDENT_MODEL_PATH}")
accident_model = YOLO(str(ACCIDENT_MODEL_PATH))

print("YOLO Machine Learning models loaded successfully.")
