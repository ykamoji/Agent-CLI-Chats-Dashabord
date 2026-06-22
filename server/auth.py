"""Session-token logic and the login_required decorator."""
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import g, jsonify, request
from werkzeug.security import check_password_hash

import config
from db import sessions_collection, users_collection
from utils import id_variants


def verify_password(stored: str | None, provided: str) -> bool:
    """Verify a password. Supports Werkzeug hashes and falls back to plaintext
    comparison for legacy/seed data that wasn't hashed."""
    if not stored:
        return False
    try:
        if check_password_hash(stored, provided):
            return True
    except Exception:
        pass
    return secrets.compare_digest(str(stored), str(provided))


def create_session(user_id: str):
    """Create a session token valid for SESSION_TTL_MINUTES."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=config.SESSION_TTL_MINUTES)
    sessions_collection().insert_one(
        {
            "token": token,
            "user_id": str(user_id),
            "created_at": now,
            "expires_at": expires_at,
        }
    )
    return token, expires_at


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def get_active_session(token: str | None):
    """Return the session document if the token exists and has not expired."""
    if not token:
        return None
    session = sessions_collection().find_one({"token": token})
    if not session:
        return None
    if _as_utc(session["expires_at"]) < datetime.now(timezone.utc):
        return None
    return session


def revoke_session(token: str | None) -> None:
    if token:
        sessions_collection().delete_one({"token": token})


def extract_token() -> str | None:
    """Read the token from the Authorization: Bearer header (or X-Session-Token)."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    return request.headers.get("X-Session-Token")


def find_user_by_id(user_id):
    """Look up a user by an explicit user_id field or by its _id."""
    variants = id_variants(user_id)
    return users_collection().find_one(
        {"$or": [{"user_id": {"$in": variants}}, {"_id": {"$in": variants}}]}
    )


def login_required(f):
    """Decorator that rejects requests without an active session token."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        token = extract_token()
        session = get_active_session(token)
        if not session:
            return jsonify({"error": "invalid_or_expired_session"}), 401
        g.user_id = session["user_id"]
        g.token = token
        return f(*args, **kwargs)

    return wrapper
