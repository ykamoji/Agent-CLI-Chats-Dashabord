"""Deterministic insight metrics computed straight from the logs — no model.

These are cheap to compute and always shown (the "hybrid" panel). They also feed
the LLM prompt as structured context.
"""
import re
from datetime import datetime

from db import logs_collection
from utils import id_variants

ERROR_RE = re.compile(
    r"\b(error|failed|failure|exception|denied|not found|traceback|cannot|no such)\b",
    re.I,
)
# A prompt is "specific" if it names a file/path/symbol/line.
SPECIFIC_RE = re.compile(
    r"`[^`]+`|/[\w./-]+|\b[\w-]+\.(py|ts|tsx|js|jsx|json|md|txt|css|html|go|java|rb|sh|yml|yaml)\b|line\s+\d+",
    re.I,
)
VAGUE_OPENERS = ("fix", "change", "update", "make", "improve", "do", "help", "tweak", "adjust", "refactor")

_PROJECTION = {
    "_id": 0,
    "Input": 1,
    "Output": 1,
    "Tools Used": 1,
    "session_id": 1,
    "completed At": 1,
    "completedAt": 1,
    "timestamp": 1,
    "cli_agent": 1,
    "entry_index": 1,
}


def _norm(s) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _ts(doc) -> str:
    return doc.get("completed At") or doc.get("completedAt") or doc.get("timestamp") or ""


def _pct(n: int, d: int) -> float:
    return round(100.0 * n / d, 1) if d else 0.0


def _tools_of(doc):
    tools = doc.get("Tools Used")
    return tools if isinstance(tools, list) else []


def _outliers_high(values):
    """IQR upper-fence outlier detection. Returns the threshold or None."""
    vals = sorted(v for v in values if isinstance(v, (int, float)))
    n = len(vals)
    if n < 4:
        return None
    q1 = vals[n // 4]
    q3 = vals[(3 * n) // 4]
    iqr = q3 - q1
    if iqr <= 0:
        return None
    return q3 + 1.5 * iqr


def compute_metrics(user_id: str, session_ids: list[str] | str | None = None) -> dict:
    query = {"user_id": {"$in": id_variants(user_id)}}
    if session_ids:
        if isinstance(session_ids, list):
            query["session_id"] = {"$in": session_ids}
        else:
            query["session_id"] = session_ids
    docs = list(logs_collection().find(query, _PROJECTION))

    total = len(docs)
    if total == 0:
        return {"total_turns": 0, "total_sessions": 0, "tool_calls": 0, "anomalies": []}

    tool_calls = 0
    tool_errors = 0
    distinct_tools: set[str] = set()
    tool_counts: dict[str, int] = {}
    empty_output = 0
    specific = 0
    vague = 0
    word_total = 0
    agents: dict[str, int] = {}

    # Group by session for retry detection / per-session shapes.
    by_session: dict[str, list] = {}
    for d in docs:
        sid = d.get("session_id") or "unknown"
        by_session.setdefault(sid, []).append(d)

        if not _norm(d.get("Output")):
            empty_output += 1

        inp = d.get("Input") or ""
        words = inp.split()
        word_total += len(words)
        if SPECIFIC_RE.search(inp):
            specific += 1
        first = words[0].lower().strip(":,.") if words else ""
        if len(words) < 5 or first in VAGUE_OPENERS:
            vague += 1

        agent = (d.get("cli_agent") or "other").lower()
        agents[agent] = agents.get(agent, 0) + 1

        for t in _tools_of(d):
            if not isinstance(t, dict):
                continue
            tool_calls += 1
            name = t.get("tool")
            if name:
                distinct_tools.add(name)
                tool_counts[name] = tool_counts.get(name, 0) + 1
            if ERROR_RE.search(str(t.get("result") or "")):
                tool_errors += 1

    # Retry clusters: consecutive near-duplicate inputs within a session.
    retry_clusters = 0
    retry_sessions: list[str] = []
    for sid, items in by_session.items():
        items.sort(key=lambda d: d.get("entry_index", 0))
        prev = None
        flagged = False
        for d in items:
            cur = _norm(d.get("Input"))
            if cur and cur == prev:
                retry_clusters += 1
                flagged = True
            prev = cur
        if flagged:
            retry_sessions.append(sid)

    top_tools = sorted(tool_counts.items(), key=lambda kv: kv[1], reverse=True)[:8]

    metrics = {
        "total_turns": total,
        "total_sessions": len(by_session),
        "tool_calls": tool_calls,
        "distinct_tools": len(distinct_tools),
        "top_tools": [{"tool": k, "count": v} for k, v in top_tools],
        "empty_output_rate": _pct(empty_output, total),
        "tool_error_rate": _pct(tool_errors, tool_calls),
        "retry_clusters": retry_clusters,
        "prompt_specificity_rate": _pct(specific, total),
        "vague_prompt_rate": _pct(vague, total),
        "avg_prompt_words": round(word_total / total, 1),
        "avg_tools_per_turn": round(tool_calls / total, 2),
        "agent_breakdown": agents,
    }

    # Per-session shape (session scope only - assumes single session_id).
    if isinstance(session_ids, str):
        items = by_session.get(session_ids, docs)
        stamps = sorted(t for t in (_ts(d) for d in items) if t)
        duration = None
        if len(stamps) >= 2:
            try:
                start = datetime.fromisoformat(stamps[0])
                end = datetime.fromisoformat(stamps[-1])
                duration = int((end - start).total_seconds())
            except ValueError:
                duration = None
        error_turns = sum(1 for d in items if not _norm(d.get("Output")))
        metrics["session_shape"] = {
            "conversations": len(items),
            "duration_seconds": duration,
            "tools_per_turn": round(tool_calls / len(items), 2) if items else 0,
            "error_turns": error_turns,
        }

    # Deterministic anomalies.
    anomalies: list[str] = []
    if not isinstance(session_ids, str):
        turn_counts = [len(v) for v in by_session.values()]
        fence = _outliers_high(turn_counts)
        if fence is not None:
            for sid, items in by_session.items():
                if len(items) > fence:
                    anomalies.append(
                        f"Session {sid[:8]}… is unusually long ({len(items)} Conversations)."
                    )
    if metrics["empty_output_rate"] >= 20:
        anomalies.append(
            f"{metrics['empty_output_rate']}% of Conversations produced no output (possible errors)."
        )
    if metrics["tool_error_rate"] >= 15:
        anomalies.append(
            f"{metrics['tool_error_rate']}% of tool calls returned an error-like result."
        )
    if retry_clusters:
        where = ", ".join(s[:8] + "…" for s in retry_sessions[:3])
        anomalies.append(
            f"{retry_clusters} repeated prompt(s) detected (retry loops) in: {where}."
        )
    metrics["anomalies"] = anomalies

    return metrics
