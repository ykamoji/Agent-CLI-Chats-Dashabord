"""AI + deterministic insights.

POST /api/insights {scope, session_id?}  — generate (async) and persist a row in
the ``insights`` collection. Auth required (Gemini calls cost money; demo is
read-only).

GET  /api/insights?scope=&session_id=    — latest stored row + freshly computed
deterministic metrics + modelAvailable. Demo allowed (reads the viewer's rows).
"""
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

import config
from auth import extract_token, get_active_session
from db import insights_collection, users_collection
from services import insights_llm
from services.insights_metrics import compute_metrics
from utils import id_variants, json_safe

bp = Blueprint("insights", __name__)


def _resolve_user(allow_demo: bool):
    """Return (user_id, is_demo). user_id is None when unauthenticated."""
    if allow_demo and request.args.get("demo"):
        viewer = users_collection().find_one({"role": "viewer"})
        uid = str(viewer.get("user_id") or viewer.get("_id")) if viewer else None
        return uid, True
    session = get_active_session(extract_token())
    if not session:
        return None, False
    return (session["user_id"] or request.args.get("user_id")), False


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _latest(user_id: str, scope: str, session_id: str | None = None, group_name: str | None = None):
    query = {"user_id": str(user_id), "scope": scope}
    if scope == "session":
        query["session_id"] = session_id
    elif scope == "group":
        query["group_name"] = group_name
    return insights_collection().find_one(query, sort=[("timestamp", -1)])


def _all_docs(user_id: str, scope: str, session_id: str | None = None, group_name: str | None = None):
    query = {"user_id": str(user_id), "scope": scope}
    if scope == "session":
        query["session_id"] = session_id
    elif scope == "group":
        query["group_name"] = group_name
    return list(insights_collection().find(query).sort("timestamp", -1))


def _generate_and_store(doc_id, user_id: str, scope: str, session_ids: list[str] | str | None, custom_config: dict | None = None):
    """Background worker: run the model and update the pending row."""
    coll = insights_collection()
    try:
        metrics = compute_metrics(user_id, session_ids)
        result = insights_llm.generate(user_id, scope, session_ids, metrics, custom_config)
        if result is None:
            coll.update_one(
                {"_id": doc_id},
                {"$set": {"status": "error", "error": "model_unavailable",
                          "timestamp": datetime.now(timezone.utc)}},
            )
            return
        coll.update_one(
            {"_id": doc_id},
            {"$set": {
                "status": "complete",
                "insights": result.get("insights", []),
                "recommendations": result.get("recommendations", []),
                "anomalies": result.get("anomalies", []),
                "reasoning": result.get("reasoning", ""),
                "logs_used_count": result.get("logs_used_count", 0),
                "model": result.get("model", config.GOOGLE_MODEL_NAME),
                "error": None,
                "timestamp": datetime.now(timezone.utc),
            }},
        )
    except Exception as exc:  # pragma: no cover - depends on live model
        coll.update_one(
            {"_id": doc_id},
            {"$set": {"status": "error", "error": str(exc),
                      "timestamp": datetime.now(timezone.utc)}},
        )


@bp.post("/api/insights")
def create_insights():
    if not insights_llm.is_available():
        return jsonify({"error": "model_unavailable"}), 503

    user_id, _ = _resolve_user(allow_demo=True)
    if not user_id:
        return jsonify({"error": "invalid_or_expired_session"}), 401

    data = request.get_json(silent=True) or {}
    scope = data.get("scope") or "global"
    if scope not in ("global", "session", "group"):
        return jsonify({"error": "invalid_scope"}), 400
    session_id = data.get("session_id") if scope == "session" else None
    if scope == "session" and not session_id:
        return jsonify({"error": "session_id_required"}), 400
    group_name = data.get("group_name") if scope == "group" else None
    if scope == "group" and not group_name:
        return jsonify({"error": "group_name_required"}), 400
    
    session_ids_list = data.get("session_ids") if scope == "group" else None
    session_ids_for_generation = session_ids_list if scope == "group" else session_id

    force = bool(data.get("force"))
    coll = insights_collection()

    # Don't stack concurrent generations.
    query = {"user_id": str(user_id), "scope": scope, "status": "pending"}
    if scope == "session":
        query["session_id"] = session_id
    elif scope == "group":
        query["group_name"] = group_name

    if coll.find_one(query):
        return jsonify({"status": "pending"}), 202

    # Reuse a recent completed row unless forced.
    latest = _latest(user_id, scope, session_id, group_name)
    if latest and latest.get("status") == "complete" and not force:
        age = (datetime.now(timezone.utc) - _as_utc(latest["timestamp"])).total_seconds()
        if age < config.INSIGHTS_MIN_REGEN_SECONDS:
            return jsonify({"status": "complete", "doc": json_safe(latest)}), 202

    doc = {
        "user_id": str(user_id),
        "scope": scope,
        "session_id": session_id,
        "group_name": group_name,
        "status": "pending",
        "timestamp": datetime.now(timezone.utc),
        "logs_used_count": 0,
        "insights": [],
        "recommendations": [],
        "anomalies": [],
        "reasoning": "",
        "model": config.GOOGLE_MODEL_NAME,
        "error": None,
    }
    doc_id = coll.insert_one(doc).inserted_id

    custom_config = data.get("config")

    threading.Thread(
        target=_generate_and_store,
        args=(doc_id, str(user_id), scope, session_ids_for_generation, custom_config),
        daemon=True,
    ).start()

    return jsonify({"status": "pending", "id": str(doc_id)}), 202


@bp.get("/api/insights")
def read_insights():
    user_id, is_demo = _resolve_user(allow_demo=True)
    if not user_id:
        if not is_demo:
            return jsonify({"error": "invalid_or_expired_session"}), 401
        return jsonify({
            "docs": [], 
            "metrics": {}, 
            "modelAvailable": insights_llm.is_available(),
            "config": {
                "maxTurns": config.INSIGHTS_MAX_TURNS,
                "inputTrunc": config.INSIGHTS_INPUT_TRUNC,
                "model": config.GOOGLE_MODEL_NAME
            }
        })

    scope = request.args.get("scope") or "global"
    session_id = request.args.get("session_id") if scope == "session" else None
    group_name = request.args.get("group_name") if scope == "group" else None
    
    # In GET request, session_ids for a group could be passed as a comma-separated query param
    session_ids_param = request.args.get("session_ids")
    session_ids_list = session_ids_param.split(",") if session_ids_param else None
    session_ids_for_generation = session_ids_list if scope == "group" else session_id

    metrics = compute_metrics(user_id, session_ids_for_generation)
    all_docs = _all_docs(user_id, scope, session_id, group_name)

    return jsonify({
        "docs": [json_safe(d) for d in all_docs],
        "metrics": metrics,
        "modelAvailable": insights_llm.is_available(),
        "config": {
            "maxTurns": config.INSIGHTS_MAX_TURNS,
            "inputTrunc": config.INSIGHTS_INPUT_TRUNC,
            "model": config.GOOGLE_MODEL_NAME
        }
    })
