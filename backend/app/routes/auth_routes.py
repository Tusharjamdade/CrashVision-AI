from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.auth import (
    UserRegister,
    UserLogin,
    AuthTokenResponse,
    hash_password,
    verify_password,
    create_access_token,
    verify_token,
)
from app.database import users_collection, utc_now

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=AuthTokenResponse)
def register_user(user_in: UserRegister):
    username = user_in.username.strip().lower()
    email = user_in.email.strip().lower()

    if users_collection.find_one({"$or": [{"username": username}, {"email": email}]}):
        raise HTTPException(
            status_code=400,
            detail="Username or email is already registered.",
        )

    hashed_pw = hash_password(user_in.password)
    user_doc = {
        "username": username,
        "email": email,
        "password_hash": hashed_pw,
        "full_name": user_in.full_name or "Operator",
        "role": "operator",
        "created_at": utc_now(),
    }

    users_collection.insert_one(user_doc)

    token = create_access_token(user_doc)
    return AuthTokenResponse(
        access_token=token,
        user={
            "username": username,
            "email": email,
            "full_name": user_doc["full_name"],
            "role": user_doc["role"],
        },
    )


@router.post("/login", response_model=AuthTokenResponse)
def login_user(credentials: UserLogin):
    identifier = credentials.username_or_email.strip().lower()
    user_doc = users_collection.find_one(
        {"$or": [{"username": identifier}, {"email": identifier}]}
    )

    if not user_doc or not verify_password(credentials.password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid username/email or password.",
        )

    token = create_access_token(user_doc)
    return AuthTokenResponse(
        access_token=token,
        user={
            "username": user_doc["username"],
            "email": user_doc["email"],
            "full_name": user_doc.get("full_name", "Operator"),
            "role": user_doc.get("role", "operator"),
        },
    )


@router.get("/me")
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Bearer token",
        )

    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
        )

    return {
        "username": payload["sub"],
        "email": payload["email"],
        "full_name": payload.get("full_name", "Operator"),
        "role": payload.get("role", "operator"),
    }
