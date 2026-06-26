"""POST /api/authenticate — validate credentials, issue a session token.

If the request body includes ``"signup": true``, a new account is created
instead of looking up an existing one.
"""
import uuid

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

import config
from auth import create_session, verify_password
from db import users_collection

bp = Blueprint("authenticate", __name__)


@bp.post("/api/authenticate")
def authenticate():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("name") or "").strip()
    password = data.get("password") or ""
    is_signup = data.get("signup", False)

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    col = users_collection()

    # ------------------------------------------------------------------
    # Sign-up path
    # ------------------------------------------------------------------
    if is_signup:
        email = (data.get("email") or "").strip()
        if not email:
            return jsonify({"error": "email is required for sign-up"}), 400

        # Check for duplicate username or email.
        existing = col.find_one(
            {"$or": [{"username": username}, {"email": email}]}
        )
        if existing:
            field = "username" if existing.get("username") == username else "email"
            return jsonify({"error": f"A user with that {field} already exists"}), 409

        user_id = str(uuid.uuid4())
        col.insert_one(
            {
                "user_id": user_id,
                "username": username,
                "email": email,
                "password": generate_password_hash(password),
                "role": "user",
            }
        )

        token, expires_at = create_session(user_id)
        return jsonify(
            {
                "token": token,
                "expires_at": expires_at.isoformat(),
                "ttl_seconds": config.SESSION_TTL_MINUTES * 60,
                "user": {
                    "user_id": user_id,
                    "username": username,
                    "email": email,
                    "role": "user",
                },
            }
        )

    # ------------------------------------------------------------------
    # Sign-in path (existing behaviour)
    # ------------------------------------------------------------------
    # Allow login by username, name, or email.
    user = col.find_one(
        {"$or": [{"username": username}, {"name": username}, {"email": username}]}
    )

    if not user:
        return jsonify({"error": "invalid credentials"}), 401

    # Viewer accounts are demo/sample users — skip password verification.
    is_viewer = user.get("role") == "viewer"
    if not is_viewer and not verify_password(user.get("password"), password):
        return jsonify({"error": "invalid credentials"}), 401

    user_id = str(user.get("user_id") or user.get("_id"))
    token, expires_at = create_session(user_id)

    return jsonify(
        {
            "token": token,
            "expires_at": expires_at.isoformat(),
            "ttl_seconds": config.SESSION_TTL_MINUTES * 60,
            "user": {
                "user_id": user_id,
                "username": user.get("username") or user.get("name"),
                "email": user.get("email"),
                "role": user.get("role", "user"),
            },
        }
    )
