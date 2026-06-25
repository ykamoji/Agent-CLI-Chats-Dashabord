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


# Supported color labels for grouping sessions.
LABEL_COLORS = ("Green", "Blue")


def _find_entry(session_map, session_id: str):
    """Return the entry dict for ``session_id``, or None."""
    for entry in session_map:
        if isinstance(entry, dict) and entry.get("session_id") == session_id:
            return entry
    return None


def _apply_session_name(session_map, session_id: str, name: str):
    """Upsert a session's display name. An empty name clears it but keeps the
    entry if a label is still set; removes the entry entirely otherwise."""
    session_map = [e for e in (session_map or []) if isinstance(e, dict)]
    entry = _find_entry(session_map, session_id)
    if name:
        if entry is not None:
            entry["name"] = name
        else:
            session_map.append({"session_id": session_id, "name": name, "label": "None"})
        return session_map
    # Empty name — clear the name field; drop the entry if no label is set.
    if entry is not None:
        entry["name"] = ""
        if entry.get("label", "None") == "None":
            session_map = [e for e in session_map if e is not entry]
    return session_map


def _apply_session_label(session_map, session_id: str, label: str):
    """Upsert a session's color label."""
    session_map = [e for e in (session_map or []) if isinstance(e, dict)]
    label = label if label in LABEL_COLORS else "None"
    entry = _find_entry(session_map, session_id)
    if entry is not None:
        entry["label"] = label
        # Drop the entry entirely if both name and label are cleared.
        if label == "None" and not entry.get("name"):
            session_map = [e for e in session_map if e is not entry]
    else:
        if label != "None":
            session_map.append({"session_id": session_id, "name": "", "label": label})
    return session_map


def _apply_session_group(session_map, session_id: str, group_name: str):
    """Upsert a session's group name. An empty group_name clears it."""
    session_map = [e for e in (session_map or []) if isinstance(e, dict)]
    entry = _find_entry(session_map, session_id)
    if group_name:
        if entry is not None:
            entry["group"] = {"name": group_name}
        else:
            session_map.append({"session_id": session_id, "name": "", "label": "None", "group": {"name": group_name}})
        return session_map
    
    # Empty group name — clear the group field; drop the entry if name and label are also empty.
    if entry is not None and "group" in entry:
        del entry["group"]
        if entry.get("label", "None") == "None" and not entry.get("name"):
            session_map = [e for e in session_map if e is not entry]
    return session_map


@bp.post("/api/session/update")
def update_session_name():
    data = request.get_json(silent=True) or {}
    
    session_ids = []
    if "session_ids" in data and isinstance(data["session_ids"], list):
        session_ids = [str(sid).strip() for sid in data["session_ids"] if str(sid).strip()]
    elif data.get("session_id"):
        session_ids = [str(data.get("session_id")).strip()]

    if not session_ids:
        return jsonify({"error": "session_id or session_ids is required"}), 400

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
    
    for sid in session_ids:
        if "name" in data:
            session_map = _apply_session_name(session_map, sid, (data.get("name") or "").strip())
        if "label" in data:
            session_map = _apply_session_label(session_map, sid, (data.get("label") or "None").strip())
        if "group" in data:
            session_map = _apply_session_group(session_map, sid, (data.get("group") or "").strip())

    user_id = str(user.get("user_id") or user.get("_id"))
    variants = id_variants(user_id)
    users_collection().update_one(
        {"$or": [{"user_id": {"$in": variants}}, {"_id": {"$in": variants}}]},
        {"$set": {"session_map": session_map}},
    )

    return jsonify({"session_map": json_safe(session_map)})
