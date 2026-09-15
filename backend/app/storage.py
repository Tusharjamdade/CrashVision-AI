import io
from typing import Optional
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from botocore.config import Config
from app.config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    S3_BUCKET_NAME,
    PRESIGNED_URL_EXPIRES,
)

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
print(f"S3 client initialized for bucket: {S3_BUCKET_NAME} in region: {AWS_REGION}")


def s3_upload_bytes(data: bytes, key: str, content_type: str) -> None:
    """Upload bytes directly to the S3 bucket configured in environment variables."""
    try:
        s3.upload_fileobj(
            io.BytesIO(data),
            S3_BUCKET_NAME,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        print(f"Successfully uploaded {len(data)} bytes to s3://{S3_BUCKET_NAME}/{key}")
    except (BotoCoreError, ClientError) as exc:
        print(f"S3 upload failed for s3://{S3_BUCKET_NAME}/{key}:", exc)


def s3_presigned_url(key: Optional[str]) -> Optional[str]:
    """Create a temporary presigned URL for direct in-browser streaming and image rendering."""
    if not key:
        return None

    try:
        url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": S3_BUCKET_NAME, "Key": key},
            ExpiresIn=PRESIGNED_URL_EXPIRES,
            HttpMethod="GET",
        )
        return url
    except (BotoCoreError, ClientError) as exc:
        print(f"Could not create presigned URL for {key}:", exc)
        if key.endswith(".mp4"):
            return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
        return "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80"


def serialize_record(record: dict) -> dict:
    """Convert MongoDB document into a frontend-friendly JSON object with presigned S3 URLs."""
    record_id = record.get("record_id") or str(record["_id"])

    created_at = record.get("created_at")
    created_at_str = (
        created_at.isoformat()
        if hasattr(created_at, "isoformat")
        else str(created_at)
        if created_at
        else None
    )

    result = {
        "id": record_id,
        "record_id": record_id,
        "created_at": created_at_str,
        "status": record.get("status", "processing"),
        "accident": record.get("accident", True),
        "confidence": record.get("confidence", 0.0),
        "objects": record.get("objects", []),
        "report": record.get("report"),
        "video": None,
        "image": None,
    }

    if record.get("video_key"):
        result["video"] = {
            "key": record["video_key"],
            "url": s3_presigned_url(record["video_key"]),
        }

    if record.get("image_key"):
        result["image"] = {
            "key": record["image_key"],
            "url": s3_presigned_url(record["image_key"]),
        }

    return result
