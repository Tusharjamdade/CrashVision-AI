import cv2
import uuid
import shutil
import subprocess
from collections import deque
from pathlib import Path
from threading import Lock, Thread

from app.config import (
    BASE_DIR,
    CAMERA_INDEX,
    FPS,
    CONFIDENCE_THRESHOLD,
    CONSECUTIVE_FRAMES_REQUIRED,
    PRE_EVENT_SECONDS,
    POST_EVENT_SECONDS,
    FFMPEG_AVAILABLE,
)
from app.database import records_collection, utc_now
from app.storage import s3_upload_bytes, s3_presigned_url
from app.ml_models import detector, accident_model
from app.ai import generate_report
from app.mlflow_tracker import log_incident_run

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

frame_buffer = deque(maxlen=max(1, FPS * PRE_EVENT_SECONDS))

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


def _encode_video_ffmpeg(frames, temp_dir: Path) -> bytes:
    frames_dir = temp_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    for idx, frame in enumerate(frames):
        frame_path = frames_dir / f"frame_{idx:06d}.jpg"
        cv2.imwrite(str(frame_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])

    output_path = temp_dir / "output.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%06d.jpg"),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-movflags", "+faststart",
        "-an",
        str(output_path),
    ]

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        stderr_text = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"ffmpeg encoding failed:\n{stderr_text}")

    return output_path.read_bytes()


def _encode_video_opencv(frames, temp_dir: Path) -> bytes:
    if not frames:
        raise ValueError("No frames to encode.")

    height, width = frames[0].shape[:2]
    width = width if width % 2 == 0 else width - 1
    height = height if height % 2 == 0 else height - 1

    output_path = temp_dir / "output.mp4"

    for fourcc_str in ("avc1", "mp4v"):
        fourcc = cv2.VideoWriter_fourcc(*fourcc_str)
        writer = cv2.VideoWriter(str(output_path), fourcc, FPS, (width, height))
        if writer.isOpened():
            break
        writer.release()
    else:
        raise RuntimeError("Could not initialise OpenCV VideoWriter.")

    try:
        for frame in frames:
            resized = cv2.resize(frame, (width, height))
            writer.write(resized)
    finally:
        writer.release()

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError("OpenCV produced an empty video file.")

    return output_path.read_bytes()


def encode_video(frames) -> bytes:
    if not frames:
        raise ValueError("No frames to encode.")

    temp_dir = BASE_DIR / "tmp" / uuid.uuid4().hex
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        if FFMPEG_AVAILABLE:
            return _encode_video_ffmpeg(frames, temp_dir)
        else:
            return _encode_video_opencv(frames, temp_dir)
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


def encode_image(frame) -> bytes:
    success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise RuntimeError("Could not encode incident image.")
    return buffer.tobytes()


def finalize_incident(frames, objects: list[str], confidence: float, prediction: str):
    global processing_incident

    record_id = str(uuid.uuid4())
    created_at = utc_now()

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

        image_frame = frames[len(frames) // 2]
        video_bytes = encode_video(frames)
        image_bytes = encode_image(image_frame)

        timestamp = int(created_at.timestamp())
        video_key = f"accidents/{record_id}/incident_{timestamp}.mp4"
        image_key = f"accidents/{record_id}/incident_{timestamp}.jpg"

        s3_upload_bytes(video_bytes, video_key, "video/mp4")
        s3_upload_bytes(image_bytes, image_key, "image/jpeg")

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

        # Log to MLflow Tracker
        log_incident_run(
            record_id=record_id,
            confidence=confidence,
            objects=objects,
            prediction=prediction,
            frames_count=len(frames),
            report_text=report,
        )

        print(f"Incident {record_id} processed, stored to S3, and logged to MLflow.")

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


def process_frame(frame):
    global recording
    global saved_frames
    global post_frames_remaining
    global accident_counter
    global scene_objects
    global processing_incident

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
        and not processing_incident
    ):
        print("Accident sequence triggered. Recording evidence frames.")
        recording = True
        saved_frames = list(frame_buffer)
        post_frames_remaining = FPS * POST_EVENT_SECONDS
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
