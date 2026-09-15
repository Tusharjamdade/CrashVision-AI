import uuid
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import DESCENDING

from app.database import records_collection, chat_collection, utc_now
from app.storage import serialize_record, s3, S3_BUCKET_NAME
from app.ai import generate_chat_response
from app.mlflow_tracker import log_chat_run

router = APIRouter(prefix="/api/records", tags=["Records"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    response: str


@router.get("")
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

    records = [serialize_record(record) for record in cursor]
    total = records_collection.count_documents({})

    return {
        "records": records,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.get("/{record_id}")
def get_record(record_id: str):
    record = records_collection.find_one({"record_id": record_id})
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Incident record '{record_id}' not found.",
        )

    return serialize_record(record)


@router.delete("/{record_id}")
def delete_record(record_id: str):
    record = records_collection.find_one({"record_id": record_id})
    if not record:
        raise HTTPException(
            status_code=404,
            detail="Incident record not found.",
        )

    keys = [record.get("video_key"), record.get("image_key")]
    for key in keys:
        if key:
            try:
                s3.delete_object(Bucket=S3_BUCKET_NAME, Key=key)
            except Exception as exc:
                print("S3 delete failed:", exc)

    records_collection.delete_one({"_id": record["_id"]})
    chat_collection.delete_many({"record_id": record_id})

    return {"status": "deleted", "record_id": record_id}


@router.get("/{record_id}/conversations")
def list_conversations(record_id: str):
    record = records_collection.find_one({"record_id": record_id})
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
                "created_at": item["created_at"].isoformat() if hasattr(item["created_at"], "isoformat") else str(item["created_at"]),
                "updated_at": item["updated_at"].isoformat() if hasattr(item["updated_at"], "isoformat") else str(item["updated_at"]),
                "message_count": item["message_count"],
            }
        )

    return {"conversations": conversations}


@router.get("/{record_id}/chat/history")
def get_chat_history(record_id: str, conversation_id: str):
    record = records_collection.find_one({"record_id": record_id})
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
        created = doc.get("created_at")
        messages.append(
            {
                "id": str(doc["_id"]),
                "role": doc["role"],
                "content": doc["content"],
                "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created) if created else None,
            }
        )

    return {
        "record_id": record_id,
        "conversation_id": conversation_id,
        "messages": messages,
    }


@router.post("/{record_id}/chat", response_model=ChatResponse)
async def chat(record_id: str, request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    record = records_collection.find_one({"record_id": record_id})
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Incident record '{record_id}' not found.",
        )

    conversation_id = request.conversation_id or str(uuid.uuid4())

    answer = await asyncio.to_thread(
        generate_chat_response,
        record,
        message,
        conversation_id,
    )

    now = utc_now()
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

    # Log to MLflow
    log_chat_run(record_id=record_id, user_message=message, response=answer)

    return ChatResponse(
        conversation_id=conversation_id,
        response=answer,
    )
