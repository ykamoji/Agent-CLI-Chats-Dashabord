"""GET /api/search — the user's full searchable log index.

Returns every log for the user reduced to its searchable fields (Input, Output,
tool names) plus the identifiers needed to deep-link to a row. The client caches
this in sessionStorage and searches it entirely client-side, so search is
instant and there are no per-keystroke round trips. A ``refresh=true`` query
param (the page's Sync button) bypasses the in-process cache.

Mirrors the auth/scope handling of ``blueprints/chats.py``.
"""
from flask import Blueprint, jsonify, request

import config
from auth import extract_token, get_active_session
from cache import cache
from db import logs_collection, users_collection
from utils import id_variants, json_safe

bp = Blueprint("search", __name__)


def _session_name_map(user_id: str) -> dict:
    """Map of session_id -> user-defined name from the user's session_map."""
    user = users_collection().find_one(
        {"$or": [{"user_id": {"$in": id_variants(user_id)}}, {"_id": {"$in": id_variants(user_id)}}]}
    )
    names = {}
    if user:
        for entry in user.get("session_map") or []:
            if isinstance(entry, dict) and entry.get("session_id") and entry.get("name"):
                names[entry["session_id"]] = entry["name"]
    return names


def _build_index(user_id: str) -> dict:
    trunc = config.SEARCH_FIELD_TRUNC
    pipeline = [
        {"$match": {"user_id": {"$in": id_variants(user_id)}}},
        {
            "$addFields": {
                "tool_names": {
                    "$map": {
                        "input": {"$ifNull": ["$Tools Used", []]},
                        "as": "t",
                        "in": "$$t.tool",
                    }
                }
            }
        },
        {
            "$project": {
                "_id": 0,
                "session_id": 1,
                "entry_index": 1,
                "cli_agent": 1,
                "tool_names": 1,
                "completed At": 1,
                "completedAt": 1,
                "timestamp": 1,
                "input": {"$substrCP": [{"$ifNull": ["$Input", ""]}, 0, trunc]},
                "output": {"$substrCP": [{"$ifNull": ["$Output", ""]}, 0, trunc]},
            }
        },
    ]
    names = _session_name_map(user_id)
    entries = []
    for doc in logs_collection().aggregate(pipeline):
        sid = doc.get("session_id") or ""
        tools = [t for t in (doc.get("tool_names") or []) if t]
        entries.append(
            {
                "session_id": sid,
                "session_name": names.get(sid, ""),
                "entry_index": doc.get("entry_index"),
                "cli_agent": doc.get("cli_agent") or "",
                "timestamp": doc.get("completed At") or doc.get("completedAt") or doc.get("timestamp") or "",
                "input": doc.get("input") or "",
                "output": doc.get("output") or "",
                "tools": tools,
            }
        )
    return {"entries": json_safe(entries), "count": len(entries)}


@bp.get("/api/search")
def get_search():
    force_refresh = request.args.get("refresh") in ("1", "true", "True")

    # Demo path: no auth, never cached.
    if request.args.get("demo"):
        viewer = users_collection().find_one({"role": "viewer"})
        if not viewer:
            return jsonify({"entries": [], "count": 0})
        user_id = str(viewer.get("user_id") or viewer.get("_id"))
        if not user_id:
            return jsonify({"entries": [], "count": 0})
        return jsonify(_build_index(user_id))

    # Authenticated path.
    token = extract_token()
    session = get_active_session(token)
    if not session:
        return jsonify({"error": "invalid_or_expired_session"}), 401

    user_id = session["user_id"] or request.args.get("user_id")
    if not user_id:
        return jsonify({"entries": [], "count": 0})

    cache_key = f"search_index:{user_id}"
    result = None
    if not force_refresh:
        result = cache.get(cache_key)
    if result is None:
        result = _build_index(user_id)
        cache.set(cache_key, result, timeout=config.CHATS_CACHE_TTL)

    return jsonify(result)
