import { useState } from "react";
import { getTurnTools } from "@/lib/api";
import { type Row, type ToolUse } from "@/lib/chats";

export type ExportFormat = "csv" | "json" | "markdown";
export type SortDir = "asc" | "desc";

export type ExportCol = {
  key: string;
  label: string;
  get: (r: Row, num: number) => string | number;
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function csvEscape(v: string | number): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Escape a value for use inside a Markdown table cell. */
function mdCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

/** Render a scalar value for a Markdown key–value line. */
function mdValue(v: unknown): string {
  if (v == null) return "—";
  const s = String(v);
  if (s === "") return "—";
  // Wrap multi-line or JSON-like values in a fenced code block.
  if (/[\n\r]/.test(s) || s.startsWith("{") || s.startsWith("[")) {
    return "\n\n```\n" + s + "\n```\n";
  }
  return s;
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

function triggerDownload(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilename(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  return (
    "chats_export_" +
    [
      now.toLocaleDateString("sv-SE", { timeZone: timezone }),
      now
        .toLocaleTimeString("sv-SE", { timeZone: timezone, hour12: false })
        .replace(/:/g, "-"),
    ].join("_")
  );
}

// ---------------------------------------------------------------------------
// Format builders
// ---------------------------------------------------------------------------

function buildJson(
  ordered: Row[],
  selectedCols: ExportCol[],
  cols: Set<string>,
  toolsById: Map<string, ToolUse[]>,
  rowNumber: Map<string, number>
): string {
  const data = ordered.map((r) => {
    const o: Record<string, unknown> = {};
    const num = rowNumber.get(r.id) ?? 0;
    selectedCols.forEach((c) => (o[c.key] = c.get(r, num)));

    if (cols.has("tool:count")) o.toolCount = r.toolCount;

    const needsDetail =
      cols.has("tool:name") || cols.has("tool:argument") || cols.has("tool:result");
    if (needsDetail) {
      o.tools = (toolsById.get(r.id) ?? []).map((t) => {
        const x: Record<string, unknown> = {};
        if (cols.has("tool:name")) x.tool = t.tool;
        if (cols.has("tool:argument")) x.arguments = t.arguments;
        if (cols.has("tool:result")) x.result = t.result;
        return x;
      });
    }
    return o;
  });
  return JSON.stringify(data, null, 2);
}

function buildCsv(
  ordered: Row[],
  selectedCols: ExportCol[],
  cols: Set<string>,
  toolsById: Map<string, ToolUse[]>,
  rowNumber: Map<string, number>
): string {
  const hasName = cols.has("tool:name");
  const hasArg = cols.has("tool:argument");
  const hasRes = cols.has("tool:result");
  const hasDetail = hasName || hasArg || hasRes;

  // Determine the maximum number of tool calls across all rows so we can
  // generate a fixed, uniform set of columns.
  const maxTools = hasDetail
    ? Math.max(0, ...ordered.map((r) => (toolsById.get(r.id) ?? []).length))
    : 0;

  // Build headers: scalar cols → optional tool count → flattened per-tool cols.
  const headers = selectedCols.map((c) => c.label);
  if (cols.has("tool:count")) headers.push("Tool count");
  for (let i = 1; i <= maxTools; i++) {
    if (hasName) headers.push(`Tool ${i} name`);
    if (hasArg) headers.push(`Tool ${i} arguments`);
    if (hasRes) headers.push(`Tool ${i} result`);
  }

  const lines = ordered.map((r) => {
    const num = rowNumber.get(r.id) ?? 0;
    const vals: (string | number)[] = selectedCols.map((c) => c.get(r, num));
    const tools = toolsById.get(r.id) ?? [];
    if (cols.has("tool:count")) vals.push(r.toolCount);
    // Emit one group of cells per slot; pad with empty strings when the row
    // has fewer tools than the maximum.
    for (let i = 0; i < maxTools; i++) {
      const t = tools[i];
      if (hasName) vals.push(t?.tool ?? "");
      if (hasArg) vals.push(t ? argToStr(t.arguments) : "");
      if (hasRes) vals.push(t?.result ?? "");
    }
    return vals.map(csvEscape).join(",");
  });

  return [headers.map(csvEscape).join(","), ...lines].join("\n");
}

function buildMarkdown(
  ordered: Row[],
  selectedCols: ExportCol[],
  cols: Set<string>,
  toolsById: Map<string, ToolUse[]>,
  rowNumber: Map<string, number>
): string {
  const hasName = cols.has("tool:name");
  const hasArg = cols.has("tool:argument");
  const hasRes = cols.has("tool:result");
  const hasDetail = hasName || hasArg || hasRes;

  const sections = ordered.map((r, idx) => {
    const num = rowNumber.get(r.id) ?? idx + 1;
    const lines: string[] = [`## Conversation #${num}`];

    // Scalar fields as bold key–value pairs.
    selectedCols.forEach((c) => {
      lines.push(`**${c.label}:** ${mdValue(c.get(r, num))}`);
    });

    if (cols.has("tool:count")) {
      lines.push(`**Tool count:** ${r.toolCount ?? 0}`);
    }

    // Tool detail – numbered list entries, one per tool call.
    if (hasDetail) {
      const tools = toolsById.get(r.id) ?? [];
      if (tools.length === 0) {
        lines.push("");
        lines.push("*No tools used.*");
      } else {
        lines.push("");
        lines.push("**Tools:**");
        tools.forEach((t, i) => {
          // Numbered heading for each tool call.
          const toolName = t.tool ? `\`${t.tool}\`` : "*(unnamed)*";
          lines.push("");
          if (hasName) {
            lines.push(`${i + 1}. **Tool:** ${toolName}`);
          } else {
            lines.push(`${i + 1}.`);
          }
          if (hasArg) {
            const argStr = argToStr(t.arguments);
            const isComplex = /[\n\r]/.test(argStr) || argStr.startsWith("{") || argStr.startsWith("[");
            if (isComplex) {
              lines.push("   **Arguments:**");
              lines.push("   ```json");
              lines.push(argStr.split("\n").map((l) => "   " + l).join("\n"));
              lines.push("   ```");
            } else {
              lines.push(`   **Arguments:** ${argStr || "—"}`);
            }
          }
          if (hasRes) {
            const resStr = t.result ?? "";
            const isComplex = /[\n\r]/.test(resStr) || resStr.startsWith("{") || resStr.startsWith("[");
            if (isComplex) {
              lines.push("   **Result:**");
              lines.push("   ```");
              lines.push(resStr.split("\n").map((l) => "   " + l).join("\n"));
              lines.push("   ```");
            } else {
              lines.push(`   **Result:** ${resStr || "—"}`);
            }
          }
        });
      }
    }

    return lines.join("\n");
  });

  const header = `# Chat Export\n> Exported: ${new Date().toISOString()}  \n> Rows: ${ordered.length}\n`;
  return [header, ...sections].join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseExportOptions {
  rows: Row[];
  rowNumber: Map<string, number>;
  /** The unified column selection Set. Tool fields use the "tool:" prefix. */
  cols: Set<string>;
  selectedCols: ExportCol[];
  format: ExportFormat;
  order: SortDir;
  isDemo?: boolean;
}

export function useExport({
  rows,
  rowNumber,
  cols,
  selectedCols,
  format,
  order,
  isDemo = false,
}: UseExportOptions) {
  const [exporting, setExporting] = useState(false);

  const needsToolDetail =
    cols.has("tool:name") || cols.has("tool:argument") || cols.has("tool:result");

  async function handleExport() {
    if (rows.length === 0) return;

    const ordered = [...rows].sort((a, b) => {
      const d = (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0);
      return order === "asc" ? d : -d;
    });

    // Only fetch per-Conversation tool details when name/argument/result are selected.
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

    const base = buildFilename();

    if (format === "json") {
      triggerDownload(
        `${base}.json`,
        buildJson(ordered, selectedCols, cols, toolsById, rowNumber),
        "application/json"
      );
    } else if (format === "markdown") {
      triggerDownload(
        `${base}.md`,
        buildMarkdown(ordered, selectedCols, cols, toolsById, rowNumber),
        "text/markdown"
      );
    } else {
      triggerDownload(
        `${base}.csv`,
        buildCsv(ordered, selectedCols, cols, toolsById, rowNumber),
        "text/csv"
      );
    }
  }

  return { exporting, handleExport };
}
