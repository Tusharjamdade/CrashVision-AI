import cv2
import base64
import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from app.config import FPS
from app.camera import (
    monitoring,
    recording,
    accident_counter,
    saved_frames,
    scene_objects,
    state_lock,
    latest_state,
    start_camera,
    stop_camera,
    read_frame,
    process_frame,
)

router = APIRouter(tags=["Monitor"])


async def monitoring_loop(websocket: WebSocket):
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


@router.get("/api/status")
def get_status():
    with state_lock:
        return {
            "monitoring": monitoring,
            **latest_state,
        }


@router.post("/api/start")
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


@router.post("/api/stop")
async def stop_monitoring():
    global monitoring, recording, accident_counter, saved_frames, scene_objects

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


@router.websocket("/ws/monitor")
async def monitor(websocket: WebSocket):
    global monitoring
    await websocket.accept()
    print("React monitor connected.")

    try:
        await monitoring_loop(websocket)
    except WebSocketDisconnect:
        print("React monitor disconnected.")
    except Exception as exc:
        print("Monitoring stream error:", exc)
    finally:
        monitoring = False
        print("Monitoring stream closed.")
