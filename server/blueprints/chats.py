"""GET /api/chats — return chat logs.

When the ``demo`` query param is set, authentication is skipped and the first
user with ``role: 'viewer'`` is used.  Otherwise the request must carry a valid
session token.

For authenticated users the response is cached in-process per ``user_id`` (TTL
from ``CHATS_CACHE_TTL``). A ``refresh=true`` query param (sent by the UI's Sync
button) bypasses the cache and rehydrates it with a fresh DB read. The demo path
is never cached.
"""
from flask import Blueprint, jsonify, request

import config
from auth import extract_token, get_active_session
from cache import cache
from db import logs_collection, users_collection
from utils import id_variants, json_safe

bp = Blueprint("chats", __name__)


def _query_chats(user_id: str, limit: int, session_id: str = None) -> dict:
    query = {"user_id": {"$in": id_variants(user_id)}}
    if session_id:
        query["session_id"] = session_id
        
    pipeline = [
        {"$match": query},
        {"$addFields": {"tool_count": {"$size": {"$ifNull": ["$Tools Used", []]}}}},
        {"$project": {"Tools Used": 0}},
        {"$limit": limit}
    ]
    cursor = logs_collection().aggregate(pipeline)
    chats = [json_safe(doc) for doc in cursor]
    return {"chats": chats, "count": len(chats)}


def _session_map(user_id: str) -> list:
    """The user's saved session-name tags ([{session_id: name}, ...])."""
    user = users_collection().find_one(
        {"$or": [{"user_id": {"$in": id_variants(user_id)}}, {"_id": {"$in": id_variants(user_id)}}]}
    )
    if not user:
        return []
    return json_safe(user.get("session_map") or [])


@bp.get("/api/chats")
def get_chats():
    # Optional pagination.
    try:
        limit = min(int(request.args.get("limit", 100)), 500)
    except ValueError:
        limit = 100

    force_refresh = request.args.get("refresh") in ("1", "true", "True")

    session_id_param = request.args.get("session_id")

    # Demo path: no auth, never cached.
    if request.args.get("demo"):
        viewer = users_collection().find_one({"role": "viewer"})
        if not viewer:
            return jsonify({"chats": [], "count": 0})
        user_id = str(viewer.get("user_id") or viewer.get("_id"))
        if not user_id:
            return jsonify({"chats": [], "count": 0})
        result = _query_chats(user_id, limit, session_id_param)
        result["session_map"] = _session_map(user_id)
        return jsonify(result)

    # Authenticated path: require a valid session token.
    token = extract_token()
    session = get_active_session(token)
    if not session:
        return jsonify({"error": "invalid_or_expired_session"}), 401

    # Prefer session-derived user_id; fall back to an explicit query param.
    user_id = session["user_id"] or request.args.get("user_id")
    if not user_id:
        return jsonify({"chats": [], "count": 0})

    # Cache key also incorporates the limit and session_id so different page sizes/sessions don't collide.
    cache_key = f"chats:{user_id}:{limit}:{session_id_param}"

    result = None
    if not force_refresh:
        result = cache.get(cache_key)
    if result is None:
        result = _query_chats(user_id, limit, session_id_param)
        cache.set(cache_key, result, timeout=config.CHATS_CACHE_TTL)

    # session_map is read fresh (not cached) so renamed sessions show up
    # immediately without waiting for the chats cache to expire.
    return jsonify({**result, "session_map": _session_map(user_id)})

@bp.get("/api/chats/summary")
def get_chats_summary():
    force_refresh = request.args.get("refresh") in ("1", "true", "True")

    user_id = None
    if request.args.get("demo"):
        viewer = users_collection().find_one({"role": "viewer"})
        if viewer:
            user_id = str(viewer.get("user_id") or viewer.get("_id"))
    else:
        token = extract_token()
        session = get_active_session(token)
        if session:
            user_id = session["user_id"] or request.args.get("user_id")

    if not user_id:
        if not request.args.get("demo"):
            return jsonify({"error": "invalid_or_expired_session"}), 401
        return jsonify({"sessions": [], "stats": {"total": 0, "toolCalls": 0, "distinctTools": 0}, "session_map": []})

    cache_key = f"chats_summary:{user_id}"
    result = None
    if not force_refresh:
        result = cache.get(cache_key)

    if result is None:
        query = {"user_id": {"$in": id_variants(user_id)}}
        # Project only needed fields to keep it light
        projection = {
            "_id": 0,
            "session_id": 1,
            "cli_agent": 1,
            "completed At": 1,
            "completedAt": 1,
            "timestamp": 1
        }
        cursor = logs_collection().find(query, projection)
        
        session_groups = {}

        for doc in cursor:
            sid = doc.get("session_id") or "unknown"
            ts = doc.get("completed At") or doc.get("completedAt") or doc.get("timestamp") or ""

            if sid not in session_groups:
                session_groups[sid] = {
                    "sessionId": sid,
                    "latestTs": ts,
                    "count": 1,
                    "agent": doc.get("cli_agent") or "",
                }
            else:
                session_groups[sid]["count"] += 1
                if ts > session_groups[sid]["latestTs"]:
                    session_groups[sid]["latestTs"] = ts

        sessions_list = sorted(list(session_groups.values()), key=lambda x: x["latestTs"], reverse=True)

        result = {
            "sessions": sessions_list
        }
        cache.set(cache_key, result, timeout=config.CHATS_CACHE_TTL)

    session_map = _session_map(user_id)
    groups_dict = {}
    for entry in session_map:
        if isinstance(entry, dict) and entry.get("group") and entry["group"].get("name"):
            gname = entry["group"]["name"]
            groups_dict.setdefault(gname, []).append(entry.get("session_id"))
            
    groups_list = [{"name": k, "session_list": v} for k, v in groups_dict.items()]

    return jsonify({**result, "session_map": session_map, "groups": groups_list})


@bp.get("/api/chats/tool")
def get_chats_tool():
    if request.args.get("demo"):
        viewer = users_collection().find_one({"role": "viewer"})
        if not viewer:
            return jsonify({"tools": []})
        user_id = str(viewer.get("user_id") or viewer.get("_id"))
    else:
        token = extract_token()
        session = get_active_session(token)
        if not session:
            return jsonify({"error": "invalid_or_expired_session"}), 401
        user_id = session["user_id"] or request.args.get("user_id")

    if not user_id:
        return jsonify({"tools": []})

    session_id = request.args.get("session_id")
    entry_index = request.args.get("entry_index")
    if not session_id or entry_index is None:
        return jsonify({"error": "missing parameters"}), 400
        
    try:
        entry_index = int(entry_index)
    except ValueError:
        return jsonify({"error": "invalid entry_index"}), 400

    query = {
        "user_id": {"$in": id_variants(user_id)},
        "session_id": session_id,
        "entry_index": entry_index
    }
    doc = logs_collection().find_one(query, {"Tools Used": 1})
    if not doc:
        return jsonify({"tools": []})
    
    tools = doc.get("Tools Used") or []
    return jsonify({"tools": json_safe(tools)})

@bp.delete("/api/chats")
def delete_chats():
    if request.args.get("demo"):
        return jsonify({"error": "Cannot delete in demo mode"}), 403

    token = extract_token()
    session = get_active_session(token)
    if not session:
        return jsonify({"error": "invalid_or_expired_session"}), 401

    payload = request.get_json()
    if not payload or not isinstance(payload.get("records"), list):
        return jsonify({"error": "invalid_payload"}), 400

    user_id = session.get("user_id")
    records = payload["records"]
    deleted_count = 0
    valid_users = set(id_variants(user_id))

    for record in records:
        entry_index = record.get("entry_index")
        session_id = record.get("session_id")
        cli_agent = record.get("cli_agent")
        record_user_id = record.get("user_id")

        if record_user_id not in valid_users:
            continue

        query = {
            "entry_index": entry_index,
            "session_id": session_id,
            "cli_agent": cli_agent,
            "user_id": record_user_id
        }
        res = logs_collection().delete_one(query)
        deleted_count += res.deleted_count

    return jsonify({"deleted_count": deleted_count, "success": True})
