"""GET /api/profile — current user's details.
PUT /api/profile/password — update the authenticated user's password."""
from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from auth import find_user_by_id, login_required
from db import users_collection
from utils import id_variants

bp = Blueprint("profile", __name__)


@bp.get("/api/profile")
@login_required
def get_profile():
    # Prefer session-derived user_id; fall back to an explicit query param.
    user_id = g.user_id or request.args.get("user_id")
    user = find_user_by_id(user_id) if user_id else None
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify(
        {
            "user_id": str(user.get("user_id") or user.get("_id")),
            "username": user.get("username") or user.get("name"),
            "email": user.get("email"),
        }
    )


@bp.put("/api/profile/password")
@login_required
def update_password():
    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if len(new_password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400
    if new_password != confirm_password:
        return jsonify({"error": "passwords do not match"}), 400

    # Prefer session-derived user_id; fall back to an explicit query param.
    user_id = g.user_id or request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user not found"}), 404

    variants = id_variants(user_id)
    result = users_collection().update_one(
        {"$or": [{"user_id": {"$in": variants}}, {"_id": {"$in": variants}}]},
        {"$set": {"password": generate_password_hash(new_password)}},
    )

    if result.matched_count == 0:
        return jsonify({"error": "user not found"}), 404

    return jsonify({"message": "password updated"})
