"use client";

import { useState } from "react";
import { type Row } from "@/lib/chats";
import {
  useExport,
  type ExportFormat,
  type SortDir,
  type ExportCol,
} from "@/lib/useExport";

// Scalar columns (one value per row). Tool data uses the "tool:" key prefix
// below so that all selection state lives in a single `cols` Set.
const EXPORT_COLUMNS: ExportCol[] = [
  { key: "number",     label: "#",           get: (_r, n) => n },
  { key: "timestamp",  label: "Timestamp",   get: (r) => r.timestamp },
  { key: "input",      label: "Input",       get: (r) => r.input },
  { key: "output",     label: "Output",      get: (r) => r.output },
  { key: "sessionId",  label: "Session ID",  get: (r) => r.sessionId },
  { key: "agent",      label: "Agent",       get: (r) => r.agent },
  { key: "entryIndex", label: "Entry index", get: (r) => r.entryIndex },
];

// Tool sub-fields. Keys are prefixed with "tool:" to avoid clashing with
// scalar column keys while sharing the same Set.
const TOOL_FIELDS: { key: string; label: string }[] = [
  { key: "tool:count",    label: "Count"     },
  { key: "tool:name",     label: "Tool name" },
  { key: "tool:argument", label: "Argument"  },
  { key: "tool:result",   label: "Result"    },
];

const DEFAULT_COLS = new Set(["timestamp", "input", "output", "agent", "tool:count"]);

const TOOL_KEYS = new Set(TOOL_FIELDS.map((f) => f.key));

// Slide-over panel for exporting rows. Owns column/format/order selection;
// delegates file-building and download to the useExport hook.
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
  const [order, setOrder]   = useState<SortDir>("desc");
  // Single Set for all column selections – scalar cols by key, tool fields by "tool:*".
  const [cols, setCols] = useState<Set<string>>(() => new Set(DEFAULT_COLS));

  const count        = rows.length;
  const toolsEnabled = [...cols].some((k) => TOOL_KEYS.has(k));
  const selectedCols = EXPORT_COLUMNS.filter((c) => cols.has(c.key));
  const hasSelection = selectedCols.length > 0 || toolsEnabled;

  const needsToolDetail =
    cols.has("tool:name") || cols.has("tool:argument") || cols.has("tool:result");

  function toggleCol(key: string) {
    setCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Toggle all tool sub-fields on/off as a group. */
  function toggleTools() {
    setCols((prev) => {
      const next = new Set(prev);
      if (toolsEnabled) {
        TOOL_KEYS.forEach((k) => next.delete(k));
      } else {
        next.add("tool:count"); // restore sensible default
      }
      return next;
    });
  }

  const { exporting, handleExport } = useExport({
    rows,
    rowNumber,
    cols,
    selectedCols,
    format,
    order,
    isDemo,
  });

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
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-ink/15 bg-paper shadow-material transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
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

            {/* Tools — parent toggle + sub-field checkboxes */}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-paper-soft">
              <input
                type="checkbox"
                checked={toolsEnabled}
                onChange={toggleTools}
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
                      checked={cols.has(f.key)}
                      onChange={() => toggleCol(f.key)}
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
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["csv", "json", "markdown"] as ExportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  format === f
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/15 bg-white text-ink hover:bg-paper-soft"
                }`}
              >
                .{f === "markdown" ? "md" : f}
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
                { v: "asc"  as SortDir, label: "Oldest first" },
              ]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setOrder(o.v)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  order === o.v
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
              : `Export ${count} row${count !== 1 ? "s" : ""} as .${format === "markdown" ? "md" : format}`}
          </button>
        </div>
      </aside>
    </>
  );
}
