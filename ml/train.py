import os
import sys
import shutil
import time
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv
import mlflow
from ultralytics import YOLO

# Load environment variables from backend/.env
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
ENV_PATH = PROJECT_DIR / "backend" / ".env"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

# AWS S3 Credentials & Settings
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1").strip()
S3_MODEL_BUCKET_NAME = os.getenv("S3_MODEL_BUCKET_NAME", "crashvision-models-337169763677-ap-south-1").strip()

# MLflow Settings
MLFLOW_TRACKING_URI = os.getenv(
    "MLFLOW_TRACKING_URI",
    f"sqlite:///{PROJECT_DIR / 'mlflow' / 'mlflow.db'}"
).strip()


def init_s3_client():
    """Initialize AWS S3 client using environment credentials."""
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

    return boto3.client("s3", **s3_kwargs)


def upload_model_to_s3(local_model_path: Path, s3_key: str = "models/checkpoints/best.pt") -> bool:
    """Upload trained model weights (.pt) to the designated S3 model bucket."""
    if not local_model_path.exists():
        print(f"Error: Model file does not exist at {local_model_path}")
        return False

    print(f"\n[S3 Upload] Pushing trained model to s3://{S3_MODEL_BUCKET_NAME}/{s3_key}...")
    try:
        s3_client = init_s3_client()
        s3_client.upload_file(
            str(local_model_path),
            S3_MODEL_BUCKET_NAME,
            s3_key,
            ExtraArgs={"ContentType": "application/octet-stream"},
        )
        print(f"Successfully uploaded retrained model to S3 model bucket!")
        print(f"S3 Model Location: s3://{S3_MODEL_BUCKET_NAME}/{s3_key}")
        return True
    except (BotoCoreError, ClientError) as exc:
        print(f"S3 model upload failed (check AWS permissions/bucket name):", exc)
        return False


def train_model(
    data_path: str = "accident/data",
    epochs: int = 20,
    imgsz: int = 224,
    batch: int = 16,
    device: str = "cpu",
    base_model: str = "yolov8n-cls.pt",
):
    """
    Retrain the YOLOv8 classification model, log hyper-parameters, metrics & artifacts
    to MLflow, copy the best weights to checkpoints, and push the model to S3.
    """
    # 1. Setup MLflow
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment("CrashVision_YOLOv8_Training")
    print(f"MLflow Tracking URI: {MLFLOW_TRACKING_URI}")

    run_name = f"YOLOv8_Retrain_{int(time.time())}"

    with mlflow.start_run(run_name=run_name) as run:
        print(f"Started MLflow Run: {run.info.run_id}")

        # Log Parameters
        params = {
            "base_model": base_model,
            "data_path": data_path,
            "epochs": epochs,
            "imgsz": imgsz,
            "batch": batch,
            "device": device,
            "s3_model_bucket": S3_MODEL_BUCKET_NAME,
        }
        mlflow.log_params(params)

        # 2. Initialize and train model
        print(f"\n--- Loading Base Model: {base_model} ---")
        model = YOLO(base_model)

        print(f"\n--- Starting Model Training ({epochs} epochs) ---")
        train_results = model.train(
            data=data_path,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            device=device,
            workers=0,
            project="accident_detection",
            name="yolov8_cls",
            exist_ok=True,
        )

        # 3. Evaluate model
        print("\n--- Running Validation ---")
        metrics = model.val(data=data_path, split="val")

        # Log Metrics
        top1 = float(getattr(metrics, "top1", 0.0))
        top5 = float(getattr(metrics, "top5", 0.0))
        fitness = float(getattr(metrics, "fitness", 0.0))

        mlflow.log_metrics({
            "val_top1_accuracy": top1,
            "val_top5_accuracy": top5,
            "val_fitness": fitness,
        })
        print(f"Validation Top1 Accuracy: {top1 * 100:.2f}%")

        # 4. Save best weights locally
        checkpoint_dir = BASE_DIR / "models" / "checkpoints"
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        local_best_pt = checkpoint_dir / "best.pt"

        # Ultralytics saves runs to accident_detection/yolov8_cls/weights/best.pt or save_dir
        save_dir = getattr(train_results, "save_dir", None)
        if save_dir and (Path(save_dir) / "weights" / "best.pt").exists():
            trained_best = Path(save_dir) / "weights" / "best.pt"
            shutil.copy(trained_best, local_best_pt)
            print(f"Copied best trained weights to: {local_best_pt}")
            
            # Log best weights artifact to MLflow
            mlflow.log_artifact(str(local_best_pt), artifact_path="model_weights")
        elif local_best_pt.exists():
            mlflow.log_artifact(str(local_best_pt), artifact_path="model_weights")

        # 5. Push model to S3 model bucket
        s3_key = "models/checkpoints/best.pt"
        s3_success = upload_model_to_s3(local_best_pt, s3_key=s3_key)

        mlflow.set_tags({
            "model_type": "yolov8-classifier",
            "s3_bucket": S3_MODEL_BUCKET_NAME,
            "s3_model_path": f"s3://{S3_MODEL_BUCKET_NAME}/{s3_key}",
            "s3_uploaded": str(s3_success),
        })

        print("\n========================================================")
        print("Model retraining, MLflow logging, and S3 push completed!")
        print(f"MLflow Run ID: {run.info.run_id}")
        print(f"Local Model: {local_best_pt}")
        print(f"S3 Model: s3://{S3_MODEL_BUCKET_NAME}/{s3_key}")
        print("========================================================\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Retrain CrashVision YOLOv8 Accident Model with MLflow & S3 Sync")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=224, help="Image size")
    parser.add_argument("--device", type=str, default="cpu", help="Device (cpu or 0 for GPU)")
    parser.add_argument("--data", type=str, default="accident/data", help="Dataset path")

    args = parser.parse_args()
    train_model(
        data_path=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
    )
