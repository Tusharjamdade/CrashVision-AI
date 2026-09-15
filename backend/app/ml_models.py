from ultralytics import YOLO
from app.config import DETECTOR_MODEL_PATH, ACCIDENT_MODEL_PATH

print(f"Loading object detector model: {DETECTOR_MODEL_PATH}")
detector = YOLO(str(DETECTOR_MODEL_PATH))

print(f"Loading accident classifier model: {ACCIDENT_MODEL_PATH}")
accident_model = YOLO(str(ACCIDENT_MODEL_PATH))

print("YOLO Machine Learning models loaded successfully.")
