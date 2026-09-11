import os
import cv2
import time
import base64
import asyncio
import uuid
import io
from collections import deque
from pathlib import Path
from threading import Lock, Thread
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from botocore.config import Config
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq
from pymongo import MongoClient, DESCENDING
from bson import ObjectId
from pydantic import BaseModel, Field
from ultralytics import YOLO


# ============================================================
# Configuration
# ============================================================

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

ACCIDENT_MODEL_PATH = PROJECT_DIR / "ml" / "models" / "checkpoints" / "best.pt"
DETECTOR_MODEL_PATH = PROJECT_DIR / "ml" / "models" / "checkpoints" / "yolov8n.pt"

CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
FPS = int(os.getenv("FPS", "30"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.90"))
CONSECUTIVE_FRAMES_REQUIRED = int(
    os.getenv("CONSECUTIVE_FRAMES_REQUIRED", "10")
)
PRE_EVENT_SECONDS = int(os.getenv("PRE_EVENT_SECONDS", "5"))
POST_EVENT_SECONDS = int(os.getenv("POST_EVENT_SECONDS", "5"))

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "").strip()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "crashvision")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

PRESIGNED_URL_EXPIRES = int(os.getenv("PRESIGNED_URL_EXPIRES", "3600"))

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]


# ============================================================
# Startup validation
# ============================================================

if not ACCIDENT_MODEL_PATH.exists():
    raise FileNotFoundError(f"Accident model not found: {ACCIDENT_MODEL_PATH}")

if not DETECTOR_MODEL_PATH.exists():
    raise FileNotFoundError(f"Object detector not found: {DETECTOR_MODEL_PATH}")

if not S3_BUCKET_NAME:
    raise RuntimeError("S3_BUCKET_NAME is missing from backend/.env")

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY is not configured. AI report/chat will fail.")

Path(BASE_DIR / "recordings").mkdir(parents=True, exist_ok=True)


# ============================================================
# FastAPI
# ============================================================

app = FastAPI(
    title="CrashVision AI API",
    version="2.0.0",
    description="Accident detection, S3 evidence storage, reports and chat.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# AWS S3
#
# The recommended approach is to keep the bucket PRIVATE and
# give the frontend temporary presigned URLs.
#
# boto3 automatically reads:
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
# AWS_REGION
# from the environment/.env.
# ============================================================

s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"},
    ),
)


def s3_upload_bytes(
    data: bytes,
    key: str,
    content_type: str,
) -> None:
    """Upload bytes to the private S3 bucket."""
    try:
        s3.upload_fileobj(
            io.BytesIO(data),
            S3_BUCKET_NAME,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    except (BotoCoreError, ClientError) as exc:
        print("S3 upload failed:", exc)
        raise


def s3_presigned_url(key: Optional[str]) -> Optional[str]:
    """Create a temporary URL that the browser can use directly."""
    if not key:
        return None

    try:
        return s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": key,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRES,
            HttpMethod="GET",
        )
    except (BotoCoreError, ClientError) as exc:
        print("Could not create presigned URL:", exc)
        return None


# ============================================================
# MongoDB
#
# Collections:
#   accident_records
#       One document per detected accident.
#
#   chat_messages
#       Persistent chat history. Each message belongs to:
#       record_id + conversation_id
# ============================================================

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[MONGODB_DB]

records_collection = db["accident_records"]
chat_collection = db["chat_messages"]

records_collection.create_index([("created_at", DESCENDING)])
chat_collection.create_index(
    [("record_id", 1), ("conversation_id", 1), ("created_at", 1)]
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_record(record: dict) -> dict:
    """Convert MongoDB document into a frontend-friendly JSON object.

    IMPORTANT:
    MongoDB's _id is an internal ObjectId. The frontend must use the
    application-level record_id UUID because /api/records/{record_id}
    searches MongoDB using the record_id field.
    """
    record_id = record.get("record_id") or str(record["_id"])

    result = {
        "id": record_id,
        "record_id": record_id,
        "created_at": record.get("created_at"),
        "status": record.get("status", "processing"),
        "accident": record.get("accident", True),
        "confidence": record.get("confidence", 0.0),
        "objects": record.get("objects", []),
        "report": record.get("report"),
        "video": None,
        "image": None,
    }

    if result["created_at"]:
        result["created_at"] = result["created_at"].isoformat()

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


# ============================================================
# YOLO models
# ============================================================

print(f"Loading detector: {DETECTOR_MODEL_PATH}")
detector = YOLO(str(DETECTOR_MODEL_PATH))

print(f"Loading accident model: {ACCIDENT_MODEL_PATH}")
accident_model = YOLO(str(ACCIDENT_MODEL_PATH))

print("Models loaded successfully.")


# ============================================================
# LangChain + Groq
# ============================================================

llm = None

if GROQ_API_KEY:
    llm = ChatGroq(
        model=GROQ_MODEL,
        temperature=0,
        api_key=GROQ_API_KEY,
    )


report_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are CrashVision AI, an accident-monitoring assistant.

Generate a concise incident report from ONLY the supplied detection data.

Include:
1. What appears to have happened
2. Important detected objects
3. Recommended immediate action

Do not invent injuries, location, cause, vehicle details, people,
weather, road conditions, or any other facts that were not supplied.
Clearly distinguish model detection from certainty.""",
        ),
        (
            "human",
            """Detection confidence: {confidence}

Detected objects:
{objects}

The accident classifier reported:
{prediction}

Generate the incident report.""",
        ),
    ]
)

report_chain = report_prompt | llm | StrOutputParser() if llm else None


chat_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are CrashVision AI, an assistant for reviewing a detected
road accident.

You are given an incident report and machine-detected context.

Answer the user's question using only the supplied incident context and
conversation history. Do not invent injuries, location, cause, identities,
vehicle details, or events that are not present.

If the evidence does not contain an answer, say that the available incident
data does not establish it.

Be concise but useful.""",
        ),
        (
            "system",
            """Incident context:

Incident ID: {record_id}
Accident classifier confidence: {confidence}
Detected objects: {objects}

Generated report:
{report}""",
        ),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{message}"),
    ]
)

chat_chain = chat_prompt | llm | StrOutputParser() if llm else None


def generate_report(
    confidence: float,
    objects: list[str],
    prediction: str,
) -> str:
    if report_chain is None:
        return "AI report unavailable. Configure GROQ_API_KEY."

    try:
        return report_chain.invoke(
            {
                "confidence": f"{confidence:.3f}",
                "objects": ", ".join(objects) if objects else "None detected",
                "prediction": prediction,
            }
        )
    except Exception as exc:
        print("Report generation failed:", exc)
        return "Unable to generate the accident report."


def load_chat_history(
    record_id: str,
    conversation_id: str,
    limit: int = 20,
):
    docs = list(
        chat_collection.find(
            {
                "record_id": record_id,
                "conversation_id": conversation_id,
            }
        )
        .sort("created_at", 1)
        .limit(limit)
    )

    messages = []

    for doc in docs:
        role = doc.get("role")
        content = doc.get("content", "")

        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    return messages


def generate_chat_response(
    record: dict,
    message: str,
    conversation_id: str,
) -> str:
    if chat_chain is None:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Add GROQ_API_KEY to backend/.env.",
        )

    history = load_chat_history(
        str(record.get("record_id") or record["_id"]),
        conversation_id,
        limit=20,
    )

    try:
        return chat_chain.invoke(
            {
                "record_id": str(record.get("record_id") or record["_id"]),
                "confidence": f"{record.get('confidence', 0):.3f}",
                "objects": ", ".join(record.get("objects", []))
                or "None detected",
                "report": record.get("report")
                or "No incident report available yet.",
                "history": history,
                "message": message,
            }
        )
    except Exception as exc:
        print("Chat generation failed:", exc)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate AI response.",
        )


# ============================================================
# Camera state
# ============================================================

cap = None
camera_lock = Lock()
state_lock = Lock()

monitoring = False
recording = False
processing_incident = False

saved_frames = []
post_frames_remaining = 0
accident_counter = 0
scene_objects = []

frame_buffer = deque(
    maxlen=max(1, FPS * PRE_EVENT_SECONDS)
)

latest_state = {
    "accident": False,
    "confidence": 0.0,
    "objects": [],
    "recording": False,
    "processing_incident": False,
    "report": None,
    "video": None,
    "image": None,
    "record_id": None,
}


# ============================================================
# Camera helpers
# ============================================================

def start_camera():
    global cap

    with camera_lock:
        if cap is not None and cap.isOpened():
            return

        cap = cv2.VideoCapture(CAMERA_INDEX)

        if not cap.isOpened():
            cap.release()
            cap = None
            raise RuntimeError(
                f"Could not open camera {CAMERA_INDEX}. "
                "Check camera permissions or CAMERA_INDEX in .env."
            )

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, FPS)


def stop_camera():
    global cap

    with camera_lock:
        if cap is not None:
            cap.release()
            cap = None


def read_frame():
    with camera_lock:
        if cap is None or not cap.isOpened():
            return False, None

        return cap.read()


# ============================================================
# S3 evidence creation
# ============================================================

def encode_video(frames) -> bytes:
    if not frames:
        raise ValueError("No frames to encode.")

    height, width = frames[0].shape[:2]

    # Encode to a temporary local file because OpenCV's VideoWriter
    # needs a seekable video file before we upload it to S3.
    temp_dir = BASE_DIR / "tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    temp_path = temp_dir / f"{uuid.uuid4().hex}.mp4"

    writer = cv2.VideoWriter(
        str(temp_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        FPS,
        (width, height),
    )

    if not writer.isOpened():
        raise RuntimeError("Could not create MP4 video.")

    try:
        for frame in frames:
            writer.write(frame)
    finally:
        writer.release()

    data = temp_path.read_bytes()

    try:
        temp_path.unlink(missing_ok=True)
    except Exception:
        pass

    return data


def encode_image(frame) -> bytes:
    success, buffer = cv2.imencode(
        ".jpg",
        frame,
        [cv2.IMWRITE_JPEG_QUALITY, 90],
    )

    if not success:
        raise RuntimeError("Could not encode incident image.")

    return buffer.tobytes()


def finalize_incident(
    frames,
    objects: list[str],
    confidence: float,
    prediction: str,
):
    """
    Runs outside the camera frame loop.

    1. Creates MongoDB incident record.
    2. Encodes video + representative image.
    3. Uploads both to S3.
    4. Generates AI report.
    5. Updates MongoDB.
    """

    global processing_incident

    record_id = str(uuid.uuid4())
    created_at = utc_now()

    # Create the database record first so the frontend can see that
    # an incident is being processed.
    record_doc = {
        "record_id": record_id,
        "created_at": created_at,
        "status": "processing",
        "accident": True,
        "confidence": confidence,
        "objects": objects,
        "prediction": prediction,
        "report": None,
        "video_key": None,
        "image_key": None,
    }

    mongo_result = records_collection.insert_one(record_doc)
    mongo_object_id = mongo_result.inserted_id

    try:
        if not frames:
            raise RuntimeError("Incident contains no frames.")

        # Use the middle frame as the representative incident image.
        image_frame = frames[len(frames) // 2]

        video_bytes = encode_video(frames)
        image_bytes = encode_image(image_frame)

        timestamp = int(created_at.timestamp())

        video_key = (
            f"accidents/{record_id}/"
            f"incident_{timestamp}.mp4"
        )
        image_key = (
            f"accidents/{record_id}/"
            f"incident_{timestamp}.jpg"
        )

        s3_upload_bytes(
            video_bytes,
            video_key,
            "video/mp4",
        )

        s3_upload_bytes(
            image_bytes,
            image_key,
            "image/jpeg",
        )

        report = generate_report(
            confidence=confidence,
            objects=objects,
            prediction=prediction,
        )

        records_collection.update_one(
            {"_id": mongo_object_id},
            {
                "$set": {
                    "status": "completed",
                    "video_key": video_key,
                    "image_key": image_key,
                    "report": report,
                    "completed_at": utc_now(),
                }
            },
        )

        with state_lock:
            latest_state["processing_incident"] = False
            latest_state["report"] = report
            latest_state["video"] = s3_presigned_url(video_key)
            latest_state["image"] = s3_presigned_url(image_key)
            latest_state["record_id"] = record_id

        print(f"Incident {record_id} saved successfully.")

    except Exception as exc:
        print(f"Incident {record_id} processing failed:", exc)

        records_collection.update_one(
            {"_id": mongo_object_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(exc),
                    "completed_at": utc_now(),
                }
            },
        )

        with state_lock:
            latest_state["processing_incident"] = False
            latest_state["record_id"] = record_id

    finally:
        processing_incident = False


# ============================================================
# Frame processing
# ============================================================

def process_frame(frame):
    global recording
    global saved_frames
    global post_frames_remaining
    global accident_counter
    global scene_objects
    global processing_incident

    frame_buffer.append(frame.copy())

    # Object detection
    detection_results = detector.predict(
        frame,
        verbose=False,
    )
    detection = detection_results[0]
    annotated_frame = detection.plot()

    detected_objects = []

    if detection.boxes is not None:
        for box in detection.boxes:
            cls_id = int(box.cls[0])

            if cls_id in detector.names:
                detected_objects.append(
                    detector.names[cls_id]
                )

    detected_objects = sorted(set(detected_objects))

    # Accident classification
    accident_results = accident_model.predict(
        frame,
        verbose=False,
    )
    accident = accident_results[0]

    pred_class = "unknown"
    confidence = 0.0

    if accident.probs is not None:
        top1 = int(accident.probs.top1)
        pred_class = str(accident.names[top1])
        confidence = float(accident.probs.top1conf)

    is_accident = (
        pred_class.lower().strip() == "accident"
    )

    confirmed_accident = (
        is_accident
        and confidence >= CONFIDENCE_THRESHOLD
    )

    if confirmed_accident:
        accident_counter += 1
    else:
        accident_counter = 0

    status_color = (
        (0, 0, 255)
        if confirmed_accident
        else (0, 200, 0)
    )

    cv2.putText(
        annotated_frame,
        f"{pred_class}: {confidence:.2f}",
        (15, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        status_color,
        2,
        cv2.LINE_AA,
    )

    # Start recording after N consecutive accident frames.
    if (
        accident_counter >= CONSECUTIVE_FRAMES_REQUIRED
        and not recording
        and not processing_incident
    ):
        print("Accident detected. Starting evidence recording.")

        recording = True

        # Include the seconds immediately before detection.
        saved_frames = list(frame_buffer)

        post_frames_remaining = (
            FPS * POST_EVENT_SECONDS
        )

        scene_objects = detected_objects

    if recording:
        saved_frames.append(frame.copy())
        post_frames_remaining -= 1

        cv2.putText(
            annotated_frame,
            "RECORDING EVIDENCE",
            (15, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255),
            2,
            cv2.LINE_AA,
        )

        if post_frames_remaining <= 0:
            frames_for_incident = saved_frames
            objects_for_incident = list(scene_objects)
            confidence_for_incident = confidence
            prediction_for_incident = pred_class

            # Reset recording immediately so camera processing continues.
            recording = False
            processing_incident = True
            accident_counter = 0
            saved_frames = []
            scene_objects = []

            with state_lock:
                latest_state["processing_incident"] = True
                latest_state["report"] = None
                latest_state["video"] = None
                latest_state["image"] = None
                latest_state["record_id"] = None

            Thread(
                target=finalize_incident,
                args=(
                    frames_for_incident,
                    objects_for_incident,
                    confidence_for_incident,
                    prediction_for_incident,
                ),
                daemon=True,
            ).start()

    with state_lock:
        latest_state["accident"] = confirmed_accident
        latest_state["confidence"] = confidence
        latest_state["objects"] = detected_objects
        latest_state["recording"] = recording
        latest_state["processing_incident"] = processing_incident

    return annotated_frame


# ============================================================
# WebSocket monitoring
# ============================================================

async def monitoring_loop(websocket):
    global monitoring

    start_camera()
    monitoring = True

    try:
        while monitoring:
            ret, frame = read_frame()

            if not ret or frame is None:
                await asyncio.sleep(0.1)
                continue

            annotated_frame = await asyncio.to_thread(
                process_frame,
                frame,
            )

            display_frame = cv2.resize(
                annotated_frame,
                (960, 540),
                interpolation=cv2.INTER_AREA,
            )

            success, buffer = cv2.imencode(
                ".jpg",
                display_frame,
                [cv2.IMWRITE_JPEG_QUALITY, 70],
            )

            if not success:
                continue

            frame_base64 = base64.b64encode(
                buffer
            ).decode("utf-8")

            with state_lock:
                data = {
                    "type": "frame",
                    "frame": frame_base64,
                    **latest_state,
                }

            try:
                await websocket.send_json(data)
            except (WebSocketDisconnect, RuntimeError):
                break

            await asyncio.sleep(
                1 / max(FPS, 1)
            )

    finally:
        monitoring = False


# ============================================================
# Pydantic models
# ============================================================

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    response: str


# ============================================================
# Basic endpoints
# ============================================================

@app.get("/")
def root():
    return {
        "message": "CrashVision AI API",
        "status": "running",
        "bucket": S3_BUCKET_NAME,
        "database": MONGODB_DB,
    }


@app.get("/api/health")
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

    return {
        "status": "ok",
        "camera_open": bool(
            cap is not None and cap.isOpened()
        ),
        "groq_configured": llm is not None,
        "mongodb": mongo_ok,
        "s3": s3_ok,
        "s3_error": s3_error,
        "s3_bucket": S3_BUCKET_NAME,
        "aws_region": AWS_REGION,
        "accident_model": ACCIDENT_MODEL_PATH.name,
        "detector_model": DETECTOR_MODEL_PATH.name,
    }


@app.get("/api/status")
def status():
    with state_lock:
        return {
            "monitoring": monitoring,
            **latest_state,
        }


# ============================================================
# Monitoring
# ============================================================

@app.post("/api/start")
async def start_monitoring():
    global monitoring

    if monitoring:
        return {"status": "already_running"}

    try:
        start_camera()
        monitoring = True

        return {"status": "started"}

    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


@app.post("/api/stop")
async def stop_monitoring():
    global monitoring
    global recording
    global processing_incident
    global accident_counter
    global saved_frames
    global scene_objects

    monitoring = False
    recording = False
    accident_counter = 0
    saved_frames = []
    scene_objects = []

    stop_camera()

    with state_lock:
        latest_state["accident"] = False
        latest_state["confidence"] = 0.0
        latest_state["objects"] = []
        latest_state["recording"] = False

    return {"status": "stopped"}


# ============================================================
# Accident records
# ============================================================

@app.get("/api/records")
def list_records(
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    cursor = (
        records_collection.find({})
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
    )

    records = [
        serialize_record(record)
        for record in cursor
    ]

    total = records_collection.count_documents({})

    return {
        "records": records,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@app.get("/api/records/{record_id}")
def get_record(record_id: str):
    record = records_collection.find_one(
        {"record_id": record_id}
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Incident record not found.",
        )

    return serialize_record(record)


@app.delete("/api/records/{record_id}")
def delete_record(record_id: str):
    record = records_collection.find_one(
        {"record_id": record_id}
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Incident record not found.",
        )

    # Delete associated S3 files.
    keys = [
        record.get("video_key"),
        record.get("image_key"),
    ]

    for key in keys:
        if key:
            try:
                s3.delete_object(
                    Bucket=S3_BUCKET_NAME,
                    Key=key,
                )
            except Exception as exc:
                print("S3 delete failed:", exc)

    records_collection.delete_one(
        {"_id": record["_id"]}
    )

    chat_collection.delete_many(
        {"record_id": record_id}
    )

    return {
        "status": "deleted",
        "record_id": record_id,
    }


# ============================================================
# Chat
# ============================================================

@app.get("/api/records/{record_id}/conversations")
def list_conversations(record_id: str):
    record = records_collection.find_one(
        {"record_id": record_id}
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Incident record not found.",
        )

    pipeline = [
        {"$match": {"record_id": record_id}},
        {
            "$group": {
                "_id": "$conversation_id",
                "created_at": {"$min": "$created_at"},
                "updated_at": {"$max": "$created_at"},
                "message_count": {"$sum": 1},
            }
        },
        {"$sort": {"updated_at": -1}},
    ]

    conversations = []

    for item in chat_collection.aggregate(pipeline):
        conversations.append(
            {
                "conversation_id": item["_id"],
                "created_at": item["created_at"].isoformat(),
                "updated_at": item["updated_at"].isoformat(),
                "message_count": item["message_count"],
            }
        )

    return {"conversations": conversations}


@app.get("/api/records/{record_id}/chat/history")
def get_chat_history(
    record_id: str,
    conversation_id: str,
):
    record = records_collection.find_one(
        {"record_id": record_id}
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Incident record not found.",
        )

    docs = list(
        chat_collection.find(
            {
                "record_id": record_id,
                "conversation_id": conversation_id,
            }
        ).sort("created_at", 1)
    )

    messages = []

    for doc in docs:
        messages.append(
            {
                "id": str(doc["_id"]),
                "role": doc["role"],
                "content": doc["content"],
                "created_at": doc["created_at"].isoformat(),
            }
        )

    return {
        "record_id": record_id,
        "conversation_id": conversation_id,
        "messages": messages,
    }


@app.post(
    "/api/records/{record_id}/chat",
    response_model=ChatResponse,
)
async def chat(
    record_id: str,
    request: ChatRequest,
):
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    record = records_collection.find_one(
        {"record_id": record_id}
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Incident record not found.",
        )

    if record.get("status") != "completed":
        raise HTTPException(
            status_code=409,
            detail="This incident is still being processed.",
        )

    conversation_id = (
        request.conversation_id
        or str(uuid.uuid4())
    )

    # Generate answer using persistent history.
    answer = await asyncio.to_thread(
        generate_chat_response,
        record,
        message,
        conversation_id,
    )

    now = utc_now()

    # Save BOTH sides of the conversation.
    chat_collection.insert_many(
        [
            {
                "record_id": record_id,
                "conversation_id": conversation_id,
                "role": "user",
                "content": message,
                "created_at": now,
            },
            {
                "record_id": record_id,
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": answer,
                "created_at": utc_now(),
            },
        ]
    )

    return ChatResponse(
        conversation_id=conversation_id,
        response=answer,
    )


# ============================================================
# Monitoring WebSocket
# ============================================================

@app.websocket("/ws/monitor")
async def monitor(websocket: WebSocket):
    global monitoring

    await websocket.accept()
    print("React monitor connected.")

    try:
        await monitoring_loop(websocket)

    except WebSocketDisconnect:
        print("React monitor disconnected.")

    except Exception as exc:
        print("Monitoring error:", exc)

    finally:
        monitoring = False
        print("Monitoring stopped.")


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
    )