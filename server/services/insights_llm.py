"""Gemini-backed qualitative insights (ranked insights, prompt recommendations,
anomalies). Degrades gracefully: returns None when no API key / SDK is available.
"""
import json

from pydantic import BaseModel

import config
from db import logs_collection, users_collection
from services.insights_metrics import ERROR_RE, _norm, _tools_of, _ts
from utils import id_variants

try:
    from google import genai

    _GENAI_OK = True
except Exception:  # pragma: no cover - import guard
    genai = None
    _GENAI_OK = False

_client = None


class InsightsOutput(BaseModel):
    insights: list[str]          # ranked, most impactful first
    recommendations: list[str]   # concrete prompt improvements
    anomalies: list[str]         # notable / unexpected patterns
    reasoning: str               # short explanation of the analysis


def is_available() -> bool:
    return bool(_GENAI_OK and config.GOOGLE_API_KEY)


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.GOOGLE_API_KEY)
    return _client


def _build_digest(user_id: str, session_ids: list[str] | str | None, max_turns: int, input_trunc: int) -> list[dict]:
    """Compact, token-bounded per-Conversation digest (most recent Conversations first)."""
    query = {"user_id": {"$in": id_variants(user_id)}}
    if session_ids:
        if isinstance(session_ids, list):
            query["session_id"] = {"$in": session_ids}
        else:
            query["session_id"] = session_ids
    projection = {
        "_id": 0,
        "Input": 1,
        "Output": 1,
        "Tools Used": 1,
        "session_id": 1,
        "completed At": 1,
        "completedAt": 1,
        "timestamp": 1,
        "entry_index": 1,
    }
    docs = list(logs_collection().find(query, projection))
    docs.sort(key=_ts, reverse=True)
    docs = docs[: max_turns]

    # Map session_id -> user-defined name (from users.session_map), so the digest
    # labels each conversation with its readable name when one exists.
    name_by_session = {}
    user = users_collection().find_one(
        {"$or": [{"user_id": {"$in": id_variants(user_id)}}, {"_id": {"$in": id_variants(user_id)}}]}
    )
    if user:
        for entry in user.get("session_map") or []:
            if isinstance(entry, dict) and entry.get("session_id") and entry.get("name"):
                name_by_session[entry["session_id"]] = entry["name"]

    digest = []
    for d in docs:
        sid = d.get("session_id")
        session_label = name_by_session.get(sid) or (sid or "unknown")[:10]
        tools = []
        error_snippet = ""
        for t in _tools_of(d):
            if not isinstance(t, dict):
                continue
            if t.get("tool"):
                tools.append(t["tool"])
            if not error_snippet:
                res = str(t.get("result") or "")
                if ERROR_RE.search(res):
                    error_snippet = res.strip()[:120]
        digest.append(
            {
                "session": session_label,
                "prompt": (d.get("Input") or "")[: input_trunc],
                "tools": tools,
                "output_empty": not _norm(d.get("Output")),
                "error": error_snippet,
            }
        )
    return digest


def _prompt(scope: str, metrics: dict, digest: list[dict]) -> str:
    # 1. Give the model a specific analytical lens based on the scope
    if scope == "session":
        target = "a single coding session"
        lens = "Focus on micro-interactions, immediate prompt missteps, and conversation-by-conversation friction."
    elif scope == "group":
        target = "a specific group of coding sessions"
        lens = "Focus on macro-trends across this specific group, recurring bad habits, and overarching tool usage patterns."
    else:
        target = "all of the user's coding sessions"
        lens = "Focus on macro-trends, recurring bad habits across sessions, and overarching tool usage patterns."
    
    return f"""You are an expert prompt-engineering analyst for CLI coding agents (Claude, Antigravity).
Analyze {target} and produce actionable insights that help the user write better prompts.

{lens}

<metrics_data>
{json.dumps(metrics, indent=2)}
</metrics_data>

<digest_data>
{json.dumps(digest, indent=2)}
</digest_data>

Based on the provided data, return a JSON payload matching the requested schema. Adhere strictly to these rules:

*   insights: Rank the most impactful first. Ground them entirely in the data.
*   recommendations: Provide concrete prompt rewrites or habit changes (e.g., name files/lines explicitly, replace vague verbs, give acceptance criteria, front-load context).
*   anomalies: Identify unexpected or wasteful patterns (e.g., execution loops, error spikes, tool overuse).
*   reasoning: Provide 1-3 sentences explaining how you reached these conclusions.
*   CONSTRAINTS: Be concise (3-6 items per list). Do not invent data not present in the tags above. When making a recommendation or pointing out an anomaly, reference specific actions or metrics to justify it.
"""


def generate(user_id: str, scope: str, session_ids: list[str] | str | None, metrics: dict, custom_config: dict | None = None) -> dict | None:
    """Run Gemini. Returns the structured insight dict, or None if unavailable."""
    if not is_available():
        return None

    c_max_turns = config.INSIGHTS_MAX_TURNS
    c_input_trunc = config.INSIGHTS_INPUT_TRUNC
    c_model = config.GOOGLE_MODEL_NAME

    if custom_config:
        if custom_config.get("maxTurns"):
            c_max_turns = int(custom_config["maxTurns"])
        if custom_config.get("inputTrunc"):
            c_input_trunc = int(custom_config["inputTrunc"])
        if custom_config.get("model"):
            c_model = custom_config["model"]

    digest = _build_digest(user_id, session_ids, c_max_turns, c_input_trunc)
    response = _get_client().models.generate_content(
        model=c_model,
        contents=_prompt(scope, metrics, digest),
        config={
            "temperature": 0.5,
            "max_output_tokens": 8192,
            "response_mime_type": "application/json",
            "response_schema": InsightsOutput,
            "thinking_config": {
                "thinking_level": "high" 
            }
        },
    )

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, InsightsOutput):
        data = parsed.model_dump()
    else:
        data = json.loads(response.text)

    data["logs_used_count"] = len(digest)
    data["model"] = config.GOOGLE_MODEL_NAME
    return data
