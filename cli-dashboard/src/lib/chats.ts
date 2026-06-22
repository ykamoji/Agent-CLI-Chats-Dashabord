// Shared helpers for turning raw chat-log documents into normalized rows.
import { type Chat } from "@/lib/api";

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

export function fmtArgs(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
