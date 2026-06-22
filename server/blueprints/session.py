"""GET /api/session — is the current session token still active?
DELETE /api/session — log out (revoke the token).
POST /api/session/update — tag a session id with a display name."""
from flask import Blueprint, jsonify, request

from auth import (
    extract_token,
    find_user_by_id,
    get_active_session,
    revoke_session,
)
from db import users_collection
from utils import id_variants, json_safe

bp = Blueprint("session", __name__)


@bp.get("/api/session")
def session_status():
    token = extract_token()
    session = get_active_session(token)
    if not session:
        return jsonify({"active": False, "error": "invalid_or_expired_session"}), 401
    return jsonify(
        {
            "active": True,
            "user_id": session["user_id"],
            "expires_at": session["expires_at"].isoformat(),
        }
    )


@bp.delete("/api/session")
def logout():
    revoke_session(extract_token())
    return jsonify({"message": "logged out"})


def _apply_session_name(session_map, session_id: str, name: str):
    """Return an updated session_map (list of {session_id: name}). Setting an
    empty name removes the entry; otherwise it upserts in place."""
    session_map = [e for e in (session_map or []) if isinstance(e, dict)]
    if name:
        for entry in session_map:
            if session_id in entry:
                entry[session_id] = name
                return session_map
        session_map.append({session_id: name})
        return session_map
    # Empty name -> clear any existing tag for this session.
    return [e for e in session_map if session_id not in e]


# Supported color labels for grouping sessions.
LABEL_COLORS = ("Green", "Blue")


def _labels_entry(session_map):
    """Return the single {Green: [...], Blue: [...]} entry, if present."""
    for entry in session_map:
        if isinstance(entry, dict) and any(
            k in LABEL_COLORS and isinstance(entry.get(k), list) for k in entry
        ):
            return entry
    return None


def _apply_session_label(session_map, session_id: str, label: str):
    """Return an updated session_map where ``session_id`` is grouped under the
    given color label. ``None`` (or anything outside LABEL_COLORS) clears it."""
    session_map = [e for e in (session_map or []) if isinstance(e, dict)]

    entry = _labels_entry(session_map)
    if entry is None:
        entry = {c: [] for c in LABEL_COLORS}
        session_map.append(entry)

    # Normalize and remove this session from every color first (one label max).
    for color in LABEL_COLORS:
        existing = entry.get(color)
        entry[color] = [s for s in existing if s != session_id] if isinstance(existing, list) else []

    if label in LABEL_COLORS:
        entry[label].append(session_id)

    return session_map


@bp.post("/api/session/update")
def update_session_name():
    data = request.get_json(silent=True) or {}
    session_id = (data.get("session_id") or "").strip()

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    # Resolve the target user. Demo uses the shared viewer account (no auth),
    # mirroring /api/chats?demo=true; otherwise a valid session token is required.
    if request.args.get("demo"):
        user = users_collection().find_one({"role": "viewer"})
    else:
        session = get_active_session(extract_token())
        if not session:
            return jsonify({"error": "invalid_or_expired_session"}), 401
        user_id = session["user_id"] or request.args.get("user_id")
        user = find_user_by_id(user_id) if user_id else None

    if not user:
        return jsonify({"error": "user not found"}), 404

    # Apply whichever fields were sent, leaving the others untouched.
    session_map = user.get("session_map")
    if "name" in data:
        session_map = _apply_session_name(session_map, session_id, (data.get("name") or "").strip())
    if "label" in data:
        session_map = _apply_session_label(session_map, session_id, (data.get("label") or "None").strip())

    user_id = str(user.get("user_id") or user.get("_id"))
    variants = id_variants(user_id)
    users_collection().update_one(
        {"$or": [{"user_id": {"$in": variants}}, {"_id": {"$in": variants}}]},
        {"$set": {"session_map": session_map}},
    )

    return jsonify({"session_map": json_safe(session_map)})
