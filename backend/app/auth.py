import hmac
import hashlib
import secrets
import base64
import json
import time
from typing import Optional
from pydantic import BaseModel, Field
from app.config import JWT_SECRET_KEY, JWT_EXPIRATION_HOURS
from app.database import users_collection, utc_now


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5, max_length=100)
    password: str = Field(min_length=6, max_length=100)
    full_name: Optional[str] = "Operator"


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    """Hash password using PBKDF2 HMAC SHA256 (standard library)."""
    if salt is None:
        salt = secrets.token_bytes(16)
    
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return hmac.compare_digest(key, expected_key)
    except Exception:
        return False


def create_access_token(user_data: dict) -> str:
    """Create signed HMAC access token containing payload."""
    header = {"alg": "HS256", "typ": "JWT"}
    exp = int(time.time()) + (JWT_EXPIRATION_HOURS * 3600)
    
    payload = {
        "sub": user_data["username"],
        "email": user_data["email"],
        "full_name": user_data.get("full_name", "Operator"),
        "role": user_data.get("role", "operator"),
        "exp": exp,
    }

    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    
    signature_base = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        signature_base.encode("utf-8"),
        hashlib.sha256
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{signature_base}.{signature_b64}"


def verify_token(token: str) -> Optional[dict]:
    """Verify HMAC signed access token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
            
        header_b64, payload_b64, signature_b64 = parts
        signature_base = f"{header_b64}.{payload_b64}"
        
        expected_sig = hmac.new(
            JWT_SECRET_KEY.encode("utf-8"),
            signature_base.encode("utf-8"),
            hashlib.sha256
        ).digest()
        
        pad_len = 4 - (len(signature_b64) % 4)
        if pad_len < 4:
            signature_b64 += "=" * pad_len
            
        actual_sig = base64.urlsafe_b64decode(signature_b64.encode("utf-8"))
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None

        pad_len_p = 4 - (len(payload_b64) % 4)
        if pad_len_p < 4:
            payload_b64 += "=" * pad_len_p
            
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode())
        
        if payload.get("exp", 0) < time.time():
            return None
            
        return payload
    except Exception:
        return None
