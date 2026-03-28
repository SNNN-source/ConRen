"""
Authentication routes and helpers for the ConRen backend.

This version adds:
- password hashing
- signed bearer tokens
- helper dependencies for authenticated routes
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_db
from models import UserAuth, UserCreate, serialize_doc

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
TOKEN_SECRET = os.getenv("APP_SECRET", "change-this-in-production")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "replace_with_a_strong_password")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(value: str) -> str:
    return hmac.new(TOKEN_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_digest = stored_hash.split("$", 1)
    except ValueError:
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return hmac.compare_digest(actual_digest, expected_digest)


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{encoded_payload}.{_sign(encoded_payload)}"


def decode_token(token: str) -> dict:
    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token format") from exc

    if not hmac.compare_digest(signature, _sign(encoded_payload)):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def serialize_user(user_doc: dict) -> dict:
    safe_user = dict(user_doc)
    safe_user.pop("password", None)
    safe_user.pop("password_hash", None)
    return serialize_doc(safe_user)


def _admin_user() -> dict:
    return {
        "id": "admin",
        "name": "System Administrator",
        "email": ADMIN_EMAIL or "admin@conren.local",
        "role": "ADMIN",
        "is_approved": 1,
    }


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    role = payload.get("role")
    user_id = payload.get("sub")

    if role == "ADMIN":
        if user_id != "admin":
            raise HTTPException(status_code=401, detail="Invalid admin token")
        return _admin_user()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=401, detail="Invalid user token")

    db = get_db()
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")

    safe_user = serialize_user(user_doc)
    if safe_user["role"] != role:
        raise HTTPException(status_code=401, detail="Token role mismatch")
    return safe_user


def require_roles(*roles: str):
    allowed_roles = set(roles)

    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not authorized for this action")
        return current_user

    return dependency


@router.post("/signup")
async def signup(user: UserCreate):
    db = get_db()
    try:
        existing_user = await db.users.find_one({"email": user.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")

        if user.role == "ADMIN":
            raise HTTPException(status_code=403, detail="Admin signups are not allowed")

        user_dict = user.model_dump()
        raw_password = user_dict.pop("password")
        user_dict["password_hash"] = hash_password(raw_password)
        user_dict["is_approved"] = 1 if user.role == "RENTER" else 0

        result = await db.users.insert_one(user_dict)
        new_user = await db.users.find_one({"_id": result.inserted_id})
        safe_user = serialize_user(new_user)
        return {"token": create_token(safe_user["id"], safe_user["role"]), "user": safe_user}
    except Exception as e:
        print(f"Signup error: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=503, detail="Database connection failed")


@router.post("/login")
async def login(user: UserAuth):
    if ADMIN_EMAIL and ADMIN_PASSWORD and user.email == ADMIN_EMAIL and user.password == ADMIN_PASSWORD:
        admin_user = _admin_user()
        return {"token": create_token("admin", "ADMIN"), "user": admin_user}

    db = get_db()
    try:
        db_user = await db.users.find_one({"email": user.email})
        if not db_user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        stored_hash = db_user.get("password_hash")
        password_ok = verify_password(user.password, stored_hash) if stored_hash else False

        # One-time compatibility path for older plaintext users.
        if not password_ok and db_user.get("password") == user.password:
            password_ok = True
            await db.users.update_one(
                {"_id": db_user["_id"]},
                {"$set": {"password_hash": hash_password(user.password)}, "$unset": {"password": ""}},
            )
            db_user["password_hash"] = "(migrated)"
            db_user.pop("password", None)

        if not password_ok:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        safe_user = serialize_user(db_user)
        return {"token": create_token(safe_user["id"], safe_user["role"]), "user": safe_user}
    except Exception as e:
        print(f"Login error: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=503, detail="Database connection failed")
