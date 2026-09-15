import os
import tempfile
import mlflow
from typing import Optional
from app.config import (
    MLFLOW_TRACKING_URI,
    DETECTOR_MODEL_PATH,
    ACCIDENT_MODEL_PATH,
    CONFIDENCE_THRESHOLD,
    CONSECUTIVE_FRAMES_REQUIRED,
    FPS,
)

# Initialize MLflow configuration
try:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment("CrashVision_AI_Monitoring")
    print(f"MLflow tracking initialized at URI: {MLFLOW_TRACKING_URI}")
except Exception as exc:
    print("Warning: MLflow setup failed:", exc)


def log_incident_run(
    record_id: str,
    confidence: float,
    objects: list[str],
    prediction: str,
    frames_count: int,
    report_text: Optional[str] = None,
):
    """Log detection telemetry, parameters, metrics, and report artifact to MLflow."""
    try:
        with mlflow.start_run(run_name=f"Incident_{record_id[:8]}"):
            # Log Parameters
            mlflow.log_params({
                "record_id": record_id,
                "detector_model": DETECTOR_MODEL_PATH.name,
                "accident_model": ACCIDENT_MODEL_PATH.name,
                "confidence_threshold": CONFIDENCE_THRESHOLD,
                "consecutive_frames_required": CONSECUTIVE_FRAMES_REQUIRED,
                "fps": FPS,
                "prediction": prediction,
            })

            # Log Metrics
            mlflow.log_metrics({
                "confidence_score": float(confidence),
                "objects_detected_count": len(objects),
                "recorded_frames_count": frames_count,
            })

            # Log Tags
            mlflow.set_tags({
                "record_id": record_id,
                "objects_list": ", ".join(objects) if objects else "None",
                "severity": "HIGH" if confidence > 0.92 else "MEDIUM",
            })

            # Log Report Artifact if available
            if report_text:
                with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt") as tmp:
                    tmp.write(report_text)
                    tmp_path = tmp.name
                mlflow.log_artifact(tmp_path, artifact_path="incident_reports")
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

            print(f"MLflow logged run for incident {record_id}.")
    except Exception as exc:
        print("MLflow logging warning:", exc)


def log_chat_run(record_id: str, user_message: str, response: str):
    """Log conversational AI interactions to MLflow."""
    try:
        mlflow.set_experiment("CrashVision_AI_Chat")
        with mlflow.start_run(run_name=f"Chat_{record_id[:8]}"):
            mlflow.log_params({
                "record_id": record_id,
                "message_length": len(user_message),
            })
            mlflow.log_metrics({
                "response_length": len(response),
            })
            mlflow.set_tags({
                "record_id": record_id,
                "query": user_message[:50],
            })
    except Exception as exc:
        print("MLflow chat log warning:", exc)


def get_mlflow_status() -> dict:
    """Return status of MLflow tracking server and experiment telemetry."""
    try:
        exp = mlflow.get_experiment_by_name("CrashVision_AI_Monitoring")
        return {
            "tracking_uri": mlflow.get_tracking_uri(),
            "experiment_name": "CrashVision_AI_Monitoring",
            "experiment_id": exp.experiment_id if exp else "1",
            "status": "active",
        }
    except Exception as exc:
        return {
            "tracking_uri": MLFLOW_TRACKING_URI,
            "status": "degraded",
            "error": str(exc),
        }
