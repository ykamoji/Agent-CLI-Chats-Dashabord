"use client";

import { useState } from "react";
import { getTurnTools } from "@/lib/api";
import { type Row, type ToolUse } from "@/lib/chats";

type ExportFormat = "csv" | "json";
type SortDir = "asc" | "desc";
type ToolField = "count" | "name" | "argument" | "result";
type ExportCol = {
  key: string;
  label: string;
  get: (r: Row, num: number) => string | number;
};

// Scalar columns (one value per row). Tool data is handled separately below
// because a turn can have many tools, each with name/arguments/result.
const EXPORT_COLUMNS: ExportCol[] = [
  { key: "number", label: "#", get: (_r, n) => n },
  { key: "timestamp", label: "Timestamp", get: (r) => r.timestamp },
  { key: "input", label: "Input", get: (r) => r.input },
  { key: "output", label: "Output", get: (r) => r.output },
  { key: "sessionId", label: "Session ID", get: (r) => r.sessionId },
  { key: "agent", label: "Agent", get: (r) => r.agent },
  { key: "entryIndex", label: "Entry index", get: (r) => r.entryIndex },
];
const DEFAULT_EXPORT_COLS = ["timestamp", "input", "output", "agent"];

const TOOL_FIELDS: { key: ToolField; label: string }[] = [
  { key: "count", label: "Count" },
  { key: "name", label: "Tool name" },
  { key: "argument", label: "Argument" },
  { key: "result", label: "Result" },
];

function csvEscape(v: string | number): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function argToStr(a: unknown): string {
  if (a == null) return "";
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Slide-over panel for exporting rows. Owns its own column/format/order state
// and the file-building + download logic. The parent supplies the rows to
// export (already filtered to the selection, or all) and controls visibility.
export default function ExportPanel({
  open,
  onClose,
  rows,
  rowNumber,
  exportingSelected,
  isDemo = false,
}: {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  rowNumber: Map<string, number>;
  exportingSelected: boolean;
  isDemo?: boolean;
}) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [order, setOrder] = useState<SortDir>("desc");
  const [cols, setCols] = useState<Set<string>>(() => new Set(DEFAULT_EXPORT_COLS));
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [toolFields, setToolFields] = useState<Set<ToolField>>(
    () => new Set<ToolField>(["count"])
  );
  const [exporting, setExporting] = useState(false);

  const count = rows.length;
  // name/argument/result require the full Tools Used array (not in the payload).
  const needsToolDetail =
    toolsEnabled &&
    (toolFields.has("name") || toolFields.has("argument") || toolFields.has("result"));
  const hasSelection = cols.size > 0 || (toolsEnabled && toolFields.size > 0);

  function toggleCol(key: string) {
    setCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleToolField(key: ToolField) {
    setToolFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleExport() {
    const selectedCols = EXPORT_COLUMNS.filter((c) => cols.has(c.key));
    if (!hasSelection || count === 0) return;

    const ordered = [...rows].sort((a, b) => {
      const d = (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0);
      return order === "asc" ? d : -d;
    });

    // Fetch full tool data only when name/argument/result are requested.
    const toolsById = new Map<string, ToolUse[]>();
    if (needsToolDetail) {
      setExporting(true);
      try {
        const fetched = await Promise.all(
          ordered.map((r) =>
            getTurnTools(r.sessionId, r.entryIndex, isDemo).catch(() => [])
          )
        );
        ordered.forEach((r, i) => toolsById.set(r.id, (fetched[i] as ToolUse[]) ?? []));
      } finally {
        setExporting(false);
      }
    }

    const cell = (r: Row, c: ExportCol) => c.get(r, rowNumber.get(r.id) ?? 0);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const filename = "chats_export_" +
      [
        now.toLocaleDateString("sv-SE", { timeZone: timezone }), // 2026-06-23
        now.toLocaleTimeString("sv-SE", {
          timeZone: timezone,
          hour12: false,
        }).replace(/:/g, "-"),
      ].join("_")

    if (format === "json") {
      const data = ordered.map((r) => {
        const o: Record<string, unknown> = {};
        selectedCols.forEach((c) => (o[c.key] = cell(r, c)));
        if (toolsEnabled) {
          if (toolFields.has("count")) o.toolCount = r.toolCount;
          if (needsToolDetail) {
            o.tools = (toolsById.get(r.id) ?? []).map((t) => {
              const x: Record<string, unknown> = {};
              if (toolFields.has("name")) x.tool = t.tool;
              if (toolFields.has("argument")) x.arguments = t.arguments;
              if (toolFields.has("result")) x.result = t.result;
              return x;
            });
          }
        }
        return o;
      });
      downloadFile(`${filename}.json`, JSON.stringify(data, null, 2), "application/json");
    } else {
      const headers = selectedCols.map((c) => c.label);
      if (toolsEnabled) {
        if (toolFields.has("count")) headers.push("Tool count");
        if (toolFields.has("name")) headers.push("Tool names");
        if (toolFields.has("argument")) headers.push("Tool arguments");
        if (toolFields.has("result")) headers.push("Tool results");
      }
      const lines = ordered.map((r) => {
        const vals: (string | number)[] = selectedCols.map((c) => cell(r, c));
        if (toolsEnabled) {
          const tools = toolsById.get(r.id) ?? [];
          if (toolFields.has("count")) vals.push(r.toolCount);
          if (toolFields.has("name")) vals.push(tools.map((t) => t.tool ?? "").join(" | "));
          if (toolFields.has("argument"))
            vals.push(tools.map((t) => argToStr(t.arguments)).join(" | "));
          if (toolFields.has("result"))
            vals.push(tools.map((t) => t.result ?? "").join(" | "));
        }
        return vals.map(csvEscape).join(",");
      });
      downloadFile(
        `${filename}.csv`,
        [headers.map(csvEscape).join(","), ...lines].join("\n"),
        "text/csv"
      );
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/20"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-ink/15 bg-paper shadow-material transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between border-b border-ink/10 bg-white px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-bold">Export</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {count} {exportingSelected ? "selected " : ""}
              row{count !== 1 ? "s" : ""}
              {exportingSelected ? "" : " (all)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export panel"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/15 bg-white text-ink shadow-material transition-colors hover:bg-paper-soft"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Columns */}
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Columns
          </p>
          <div className="mt-2 space-y-1.5">
            {EXPORT_COLUMNS.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-paper-soft"
              >
                <input
                  type="checkbox"
                  checked={cols.has(c.key)}
                  onChange={() => toggleCol(c.key)}
                  className="rounded border-ink/30 text-ink focus:ring-ink"
                />
                {c.label}
              </label>
            ))}

            {/* Tools (expands into sub-options when checked) */}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-paper-soft">
              <input
                type="checkbox"
                checked={toolsEnabled}
                onChange={() => setToolsEnabled((v) => !v)}
                className="rounded border-ink/30 text-ink focus:ring-ink"
              />
              Tools
            </label>
            {toolsEnabled && (
              <div className="ml-6 space-y-1 border-l border-ink/10 pl-3">
                {TOOL_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-paper-soft"
                  >
                    <input
                      type="checkbox"
                      checked={toolFields.has(f.key)}
                      onChange={() => toggleToolField(f.key)}
                      className="rounded border-ink/30 text-ink focus:ring-ink"
                    />
                    {f.label}
                  </label>
                ))}
                {needsToolDetail && (
                  <p className="px-2 pt-1 text-[10px] text-ink-muted">
                    Tool name / argument / result are fetched per turn on export.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Format */}
          <p className="mt-6 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Format
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["csv", "json"] as ExportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${format === f
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-white text-ink hover:bg-paper-soft"
                  }`}
              >
                .{f}
              </button>
            ))}
          </div>

          {/* Order by date */}
          <p className="mt-6 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Order by date
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { v: "desc" as SortDir, label: "Newest first" },
                { v: "asc" as SortDir, label: "Oldest first" },
              ]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setOrder(o.v)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${order === o.v
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-white text-ink hover:bg-paper-soft"
                  }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-ink/10 bg-white px-5 py-4">
          <button
            type="button"
            onClick={handleExport}
            disabled={!hasSelection || count === 0 || exporting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-semibold text-paper shadow-material transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            )}
            {exporting
              ? "Exporting…"
              : `Export ${count} row${count !== 1 ? "s" : ""} as .${format}`}
          </button>
        </div>
      </aside>
    </>
  );
}
