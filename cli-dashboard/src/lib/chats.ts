// Shared helpers for turning raw chat-log documents into normalized rows.
import { type Bookmark, type Chat } from "@/lib/api";

export type { Bookmark };

export type ToolUse = {
  tool?: string;
  arguments?: unknown;
  result?: string;
};

export type Row = {
  id: string;
  timestamp: string; // "completed At"
  input: string;
  output: string; // "Output" — may be empty (e.g. on errors)
  tools: ToolUse[];
  toolCount: number;
  entryIndex: number;
  sessionId: string;
  agent: string;
  bookmark: Bookmark;
  raw: Chat;
};

export function str(chat: Chat, key: string): string {
  const v = chat[key];
  return typeof v === "string" ? v : "";
}

export function toRow(chat: Chat, i: number): Row {
  const toolsRaw = chat["Tools Used"];
  const toolCountRaw = chat["tool_count"];
  const toolsArray = Array.isArray(toolsRaw) ? (toolsRaw as ToolUse[]) : [];
  const bookmarkRaw = (chat.bookmark ?? {}) as Partial<Bookmark>;
  return {
    id: (typeof chat._id === "string" && chat._id) || String(i),
    timestamp:
      str(chat, "completed At") || str(chat, "completedAt") || str(chat, "timestamp"),
    input: str(chat, "Input") || str(chat, "input"),
    output: str(chat, "Output") || str(chat, "output"),
    tools: toolsArray,
    toolCount: typeof toolCountRaw === "number" ? toolCountRaw : toolsArray.length,
    entryIndex: typeof chat.entry_index === "number" ? chat.entry_index : 0,
    sessionId: str(chat, "session_id"),
    agent: str(chat, "cli_agent"),
    bookmark: {
      enabled: bookmarkRaw.enabled ? 1 : 0,
      message: typeof bookmarkRaw.message === "string" ? bookmarkRaw.message : "",
    },
    raw: chat,
  };
}

export function fmtTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts || "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Best-effort un-escaping of a JSON-string fragment that can't be parsed
// (commonly because the value was truncated upstream). Conversations \" \\ \n \t etc.
// into their real characters so the content is at least readable.
function softUnescape(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "n") { out += "\n"; i++; continue; }
      if (next === "t") { out += "\t"; i++; continue; }
      if (next === "r") { i++; continue; }
      if (next === '"' || next === "\\" || next === "/") { out += next; i++; continue; }
    }
    out += ch;
  }
  return out;
}

// Tool arguments often arrive double-encoded: an object whose values are
// themselves JSON strings (e.g. "Description": "\"...\"" or a stringified
// array). Recursively parse any string that looks like JSON so the value is
// unwrapped; if it won't parse (e.g. truncated), fall back to a soft unescape.
function deepUnescape(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^["[{]/.test(trimmed)) return value; // not JSON-ish — leave as-is
    try {
      return deepUnescape(JSON.parse(trimmed));
    } catch {
      return softUnescape(value);
    }
  }
  if (Array.isArray(value)) return value.map(deepUnescape);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepUnescape(v);
    return out;
  }
  return value;
}

// Render the (already-unescaped) value without re-escaping string content, so
// real quotes and newlines display as-is. Multi-line strings keep their breaks,
// with continuation lines indented to align under their key.
function pretty(value: unknown, indent = ""): string {
  const pad = indent + "  ";
  if (value === null) return "null";
  if (typeof value === "string") {
    if (!value.includes("\n")) return value;
    return value
      .split("\n")
      .map((line, i) => (i === 0 ? line : pad + line))
      .join("\n");
  }
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[\n" + value.map((v) => pad + pretty(v, pad)).join(",\n") + "\n" + indent + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return (
    "{\n" +
    entries.map(([k, v]) => `${pad}${k}: ${pretty(v, pad)}`).join(",\n") +
    "\n" +
    indent +
    "}"
  );
}

export function fmtArgs(value: unknown): string {
  if (value == null) return "";
  return pretty(deepUnescape(value));
}
