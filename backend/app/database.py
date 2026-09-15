from datetime import datetime, timezone
from pymongo import MongoClient, DESCENDING
from app.config import MONGODB_URI, MONGODB_DB

mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = mongo_client[MONGODB_DB]

records_collection = db["accident_records"]
chat_collection = db["chat_messages"]
users_collection = db["users"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def init_db_indexes():
    """Create database indexes safely without blocking module import."""
    try:
        records_collection.create_index([("created_at", DESCENDING)])
        records_collection.create_index([("record_id", 1)], unique=True)
        chat_collection.create_index(
            [("record_id", 1), ("conversation_id", 1), ("created_at", 1)]
        )
        users_collection.create_index([("username", 1)], unique=True)
        users_collection.create_index([("email", 1)], unique=True)
        print("Database indexes created/verified.")
    except Exception as exc:
        print("Warning: MongoDB index initialization deferred/skipped:", exc)


def seed_demo_data_if_empty():
    """Auto-seeds demo records if the collection is empty, preventing 404 errors in UI demo mode."""
    init_db_indexes()
    try:
        if records_collection.count_documents({}) == 0:
            print("Database empty. Seeding initial demo incident records...")
            demo_records = [
                {
                    "record_id": "inc-8f92a10c",
                    "created_at": utc_now(),
                    "status": "completed",
                    "accident": True,
                    "confidence": 0.962,
                    "objects": ["car", "truck", "debris"],
                    "prediction": "Accident",
                    "report": (
                        "CRASHVISION ACCIDENT REPORT\n\n"
                        "Date/Time: Recent Incident\n"
                        "Location: Highway Intersection 4B\n"
                        "Classification: High-Severity Vehicle Collision\n"
                        "Confidence Score: 96.2%\n\n"
                        "Summary:\n"
                        "A high-speed collision between a commercial truck and sedan was detected "
                        "by the YOLO vision pipeline. Rapid deceleration and debris scattering were confirmed.\n\n"
                        "Recommended Action:\n"
                        "Dispatch emergency medical services (EMS) and highway patrol immediately."
                    ),
                    "video_key": "incidents/videos/inc-8f92a10c.mp4",
                    "image_key": "incidents/images/inc-8f92a10c.jpg",
                },
                {
                    "record_id": "inc-3e41b9d1",
                    "created_at": utc_now(),
                    "status": "completed",
                    "accident": True,
                    "confidence": 0.884,
                    "objects": ["motorcycle", "car"],
                    "prediction": "Accident",
                    "report": (
                        "CRASHVISION ACCIDENT REPORT\n\n"
                        "Location: Main St & 5th Ave\n"
                        "Classification: Side Collision\n"
                        "Confidence Score: 88.4%\n\n"
                        "Summary:\n"
                        "Side-impact incident involving a sedan and motorcycle at urban traffic junction."
                    ),
                    "video_key": "incidents/videos/inc-3e41b9d1.mp4",
                    "image_key": "incidents/images/inc-3e41b9d1.jpg",
                },
                {
                    "record_id": "inc-7d12f38a",
                    "created_at": utc_now(),
                    "status": "completed",
                    "accident": True,
                    "confidence": 0.915,
                    "objects": ["bus", "car"],
                    "prediction": "Accident",
                    "report": (
                        "CRASHVISION ACCIDENT REPORT\n\n"
                        "Location: Route 9 Expressway\n"
                        "Classification: Bus & Passenger Car Rear Collision\n"
                        "Confidence Score: 91.5%\n\n"
                        "Summary:\n"
                        "Multi-vehicle impact detected involving passenger bus and sedan."
                    ),
                    "video_key": "incidents/videos/inc-7d12f38a.mp4",
                    "image_key": "incidents/images/inc-7d12f38a.jpg",
                },
            ]
            records_collection.insert_many(demo_records)
            print("Demo incident records seeded successfully.")
    except Exception as exc:
        print("Warning: Demo data seeding check skipped:", exc)


def close_db_connection():
    """Cleanly close PyMongo client to avoid shutdown threads hanging."""
    try:
        mongo_client.close()
        print("MongoDB connection closed cleanly.")
    except Exception as exc:
        print("Error closing MongoDB connection:", exc)
