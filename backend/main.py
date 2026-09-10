import os
import cv2
import time
import base64
import asyncio
from collections import deque
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from ultralytics import YOLO


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

ACCIDENT_MODEL_PATH = PROJECT_DIR / "ml" / "models" / "checkpoints" / "best.pt"
DETECTOR_MODEL_PATH = PROJECT_DIR / "ml" / "models" / "checkpoints" / "yolov8n.pt"
RECORDINGS_DIR = BASE_DIR / "recordings"

CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
FPS = int(os.getenv("FPS", "30"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.90"))
CONSECUTIVE_FRAMES_REQUIRED = int(os.getenv("CONSECUTIVE_FRAMES_REQUIRED", "10"))
PRE_EVENT_SECONDS = int(os.getenv("PRE_EVENT_SECONDS", "5"))
POST_EVENT_SECONDS = int(os.getenv("POST_EVENT_SECONDS", "5"))

RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

if not DETECTOR_MODEL_PATH.exists():
    raise FileNotFoundError(f"Object detector not found: {DETECTOR_MODEL_PATH}")

if not ACCIDENT_MODEL_PATH.exists():
    raise FileNotFoundError(f"Accident model not found: {ACCIDENT_MODEL_PATH}")


app = FastAPI(title="CrashVision AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/recordings",
    StaticFiles(directory=str(RECORDINGS_DIR)),
    name="recordings",
)


print(f"Loading detector: {DETECTOR_MODEL_PATH}")
detector = YOLO(str(DETECTOR_MODEL_PATH))

print(f"Loading accident model: {ACCIDENT_MODEL_PATH}")
accident_model = YOLO(str(ACCIDENT_MODEL_PATH))

print("Models loaded successfully.")


groq_api_key = os.getenv("GROQ_API_KEY")
llm = None

if groq_api_key:
    llm = ChatGroq(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
        temperature=0,
        api_key=groq_api_key,
    )
else:
    print("Warning: GROQ_API_KEY is not configured.")


class ChatRequest(BaseModel):
    message: str
    accident: bool = False
    confidence: float = 0.0
    objects: list[str] = Field(default_factory=list)
    report: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list)


cap = None
camera_lock = Lock()
state_lock = Lock()

monitoring = False
recording = False
saved_frames = []
post_frames_remaining = 0
accident_counter = 0
scene_objects = []

frame_buffer = deque(maxlen=max(1, FPS * PRE_EVENT_SECONDS))

latest_state = {
    "accident": False,
    "confidence": 0.0,
    "objects": [],
    "recording": False,
    "report": None,
    "video": None,
}


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
                "Check camera permissions or set CAMERA_INDEX in .env."
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


def save_accident_video(frames):
    if not frames:
        return None

    height, width = frames[0].shape[:2]
    filename = RECORDINGS_DIR / f"accident_{int(time.time())}.mp4"

    writer = cv2.VideoWriter(
        str(filename),
        cv2.VideoWriter_fourcc(*"mp4v"),
        FPS,
        (width, height),
    )

    if not writer.isOpened():
        print(f"Could not create video: {filename}")
        return None

    try:
        for frame in frames:
            writer.write(frame)
    finally:
        writer.release()

    return f"/recordings/{filename.name}"


def generate_report(objects):
    if llm is None:
        return "AI report unavailable. Configure GROQ_API_KEY in backend/.env."

    objects_text = ", ".join(objects) if objects else "None detected"

    prompt = f"""
You are CrashVision AI, an accident monitoring assistant.

Detected objects:
{objects_text}

Create a concise incident report containing:
1. What appears to have happened
2. Important objects involved
3. Recommended immediate action

Use only the supplied information. Do not invent injuries, locations,
causes, vehicle details, or other facts.
"""

    try:
        response = llm.invoke(prompt)
        return str(response.content)
    except Exception as exc:
        print("Report generation failed:", exc)
        return "Unable to generate accident report."


def generate_chat_response(request):
    if llm is None:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Add GROQ_API_KEY to backend/.env.",
        )

    history = []

    for item in request.history[-10:]:
        role = item.get("role", "user")
        content = item.get("content", "").strip()

        if content:
            history.append(f"{role.upper()}: {content}")

    conversation = "\n".join(history) or "No previous conversation."

    prompt = f"""
You are CrashVision AI, an assistant inside an accident-monitoring system.

Current monitoring state:
Accident detected: {request.accident}
Confidence: {request.confidence:.2f}
Detected objects: {", ".join(request.objects) if request.objects else "None"}

Latest incident report:
{request.report or "No incident report available."}

Recent conversation:
{conversation}

User:
{request.message}

Answer naturally and concisely.

Never claim that an accident, object, injury, location, cause, or event exists
unless it is present in the supplied monitoring context.
"""

    try:
        response = llm.invoke(prompt)
        return str(response.content)
    except Exception as exc:
        print("Chat generation failed:", exc)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate AI response.",
        )


def process_frame(frame):
    global recording
    global saved_frames
    global post_frames_remaining
    global accident_counter
    global scene_objects

    frame_buffer.append(frame.copy())

    detection_results = detector.predict(frame, verbose=False)
    detection = detection_results[0]
    annotated_frame = detection.plot()

    detected_objects = []

    if detection.boxes is not None:
        for box in detection.boxes:
            cls_id = int(box.cls[0])

            if cls_id in detector.names:
                detected_objects.append(detector.names[cls_id])

    detected_objects = sorted(set(detected_objects))

    accident_results = accident_model.predict(frame, verbose=False)
    accident = accident_results[0]

    pred_class = "unknown"
    confidence = 0.0

    if accident.probs is not None:
        top1 = int(accident.probs.top1)
        pred_class = str(accident.names[top1])
        confidence = float(accident.probs.top1conf)

    is_accident = pred_class.lower().strip() == "accident"
    confirmed_accident = is_accident and confidence >= CONFIDENCE_THRESHOLD

    if confirmed_accident:
        accident_counter += 1
    else:
        accident_counter = 0

    status_color = (0, 0, 255) if confirmed_accident else (0, 200, 0)

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

    if (
        accident_counter >= CONSECUTIVE_FRAMES_REQUIRED
        and not recording
    ):
        print("Accident detected. Starting evidence recording.")

        recording = True
        saved_frames = list(frame_buffer)
        post_frames_remaining = FPS * POST_EVENT_SECONDS
        scene_objects = detected_objects

        with state_lock:
            latest_state["report"] = None
            latest_state["video"] = None

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
            video_path = save_accident_video(saved_frames)
            report = generate_report(scene_objects)

            with state_lock:
                latest_state["report"] = report
                latest_state["video"] = video_path

            print(f"Evidence saved: {video_path}")

            recording = False
            accident_counter = 0
            saved_frames = []
            scene_objects = []

    with state_lock:
        latest_state["accident"] = confirmed_accident
        latest_state["confidence"] = confidence
        latest_state["objects"] = detected_objects
        latest_state["recording"] = recording

    return annotated_frame


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

            annotated_frame = await asyncio.to_thread(process_frame, frame)

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

            frame_base64 = base64.b64encode(buffer).decode("utf-8")

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

            await asyncio.sleep(1 / max(FPS, 1))

    finally:
        monitoring = False


@app.get("/")
def root():
    return {
        "message": "CrashVision AI API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "camera_open": bool(cap is not None and cap.isOpened()),
        "groq_configured": llm is not None,
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
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/stop")
async def stop_monitoring():
    global monitoring
    global recording
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


@app.post("/api/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    request.message = message

    answer = await asyncio.to_thread(
        generate_chat_response,
        request,
    )

    return {"response": answer}


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
    )
