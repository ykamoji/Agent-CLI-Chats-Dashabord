"use client";

import { useMemo, useState } from "react";
import { type Chat } from "@/lib/api";
import { fmtTime, toRow, type Row } from "@/lib/chats";
import AgentBadge from "@/components/AgentBadge";
import ExportPanel from "@/components/ExportPanel";

type SortKey = "timestamp" | "input" | "output" | "tools" | "sessionId" | "agent";
type SortDir = "asc" | "desc";



export default function ChatTable({
  chats,
  loading,
  error,
  hideSession = false,
  title = "Recent Conversations",
  onRefresh,
  refreshing = false,
  selectedId = null,
  onRowClick,
  onDelete,
  isDemo = false,
}: {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  hideSession?: boolean;
  title?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  selectedId?: string | null;
  // Called with the clicked row and its stable (timestamp-ascending) number.
  onRowClick?: (row: Row, rowNumber: number) => void;
  onDelete?: (selectedRawChats: Chat[]) => Promise<void>;
  isDemo?: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "timestamp",
    dir: "desc",
  });
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Export panel visibility (the panel owns its own config + download logic).
  const [exportOpen, setExportOpen] = useState(false);

  const rows = useMemo(() => chats.map(toRow), [chats]);

  // Stable row number: 1-based, fixed to timestamp-ascending order.
  const rowNumber = useMemo(() => {
    const byTime = [...rows].sort(
      (a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0)
    );
    const map = new Map<string, number>();
    byTime.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [rows]);

  const sorted = useMemo(() => {
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case "timestamp":
          return Date.parse(r.timestamp) || 0;
        case "tools":
          return r.toolCount;
        case "input":
          return r.input.toLowerCase();
        case "output":
          return r.output.toLowerCase();
        case "sessionId":
          return r.sessionId.toLowerCase();
        case "agent":
          return r.agent.toLowerCase();
      }
    };
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  // Rows the export panel should act on: the selection, or all when none.
  const exportingSelected = selectionEnabled && selectedRowIds.size > 0;
  const exportRows = exportingSelected
    ? rows.filter((r) => selectedRowIds.has(r.id))
    : rows;

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sort.key === k;
    return (
      <th className="px-5 py-3 font-medium">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        >
          {label}
          <span className={active ? "text-ink" : "text-ink-muted/40"}>
            {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  const colSpan = (hideSession ? 5 : 7);
  const effectiveColSpan = selectionEnabled ? colSpan + 1 : colSpan;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-material">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <div className="flex items-center gap-3">
            {selectionEnabled && selectedRowIds.size > 0 && onDelete && (
              <button
                type="button"
                onClick={async () => {
                  setDeleting(true);
                  const toDelete = rows.filter(r => selectedRowIds.has(r.id)).map(r => r.raw);
                  try {
                    await onDelete(toDelete);
                    setSelectedRowIds(new Set());
                    setSelectionEnabled(false);
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-600 shadow-material transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className={`h-3.5 w-3.5 ${deleting ? "animate-pulse" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectionEnabled(!selectionEnabled);
                setSelectedRowIds(new Set());
              }}
              disabled={loading || deleting}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectionEnabled ? "Cancel Selection" : "Select"}
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              disabled={loading || deleting || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Export
            </button>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading || refreshing || deleting}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
                {refreshing ? "Syncing…" : "Sync"}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-muted">
                {selectionEnabled && (
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={sorted.length > 0 && selectedRowIds.size === sorted.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(new Set(sorted.map(r => r.id)));
                        } else {
                          setSelectedRowIds(new Set());
                        }
                      }}
                      className="rounded border-ink/30 text-ink focus:ring-ink"
                    />
                  </th>
                )}
                <th className="px-5 py-3 font-medium">#</th>
                <SortHeader label="Timestamp" k="timestamp" />
                <SortHeader label="Input" k="input" />
                <SortHeader label="Output" k="output" />
                <SortHeader label="Tools Used" k="tools" />
                {!hideSession && <SortHeader label="Session" k="sessionId" />}
                {!hideSession && <SortHeader label="Agent" k="agent" />}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={effectiveColSpan} className="px-5 py-10 text-center text-ink-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={effectiveColSpan} className="px-5 py-10 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && sorted.length === 0 && (
                <tr>
                  <td colSpan={effectiveColSpan} className="px-5 py-10 text-center text-ink-muted">
                    No chat logs yet.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                sorted.map((r, index) => {
                  const selected = selectedId === r.id;
                  const isChecked = selectedRowIds.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onRowClick?.(r, rowNumber.get(r.id) ?? 0)}
                      aria-selected={selected}
                      className={`border-b border-ink/5 align-top transition-colors ${onRowClick ? "cursor-pointer" : ""
                        } ${selected
                          ? "bg-ink/5 ring-1 ring-inset ring-ink/20"
                          : isChecked
                            ? "bg-ink/5"
                            : "hover:bg-paper-soft"
                        }`}
                    >
                      {selectionEnabled && (
                        <td className="px-5 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedRowIds);
                              if (e.target.checked) {
                                next.add(r.id);
                              } else {
                                next.delete(r.id);
                              }
                              setSelectedRowIds(next);
                            }}
                            className="rounded border-ink/30 text-ink focus:ring-ink"
                          />
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-ink-muted">
                        {index + 1}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-ink-muted">
                        <span title={r.timestamp}>{fmtTime(r.timestamp)}</span>
                      </td>
                      <td className="max-w-sm px-5 py-4">
                        <span className="line-clamp-2 font-medium" title={r.input}>
                          {r.input || "—"}
                        </span>
                      </td>
                      <td className="max-w-sm px-5 py-4">
                        {r.output ? (
                          <span className="line-clamp-2 text-ink-muted" title={r.output}>
                            {r.output}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {r.toolCount === 0 ? (
                          <span className="text-ink-muted">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-paper-soft px-2 py-1 text-xs font-medium">
                            <span className="font-mono">{r.toolCount}</span>
                            tool{r.toolCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      {!hideSession && (
                        <td className="px-5 py-4">
                          <span
                            className="font-mono text-xs text-ink-muted"
                            title={r.sessionId}
                          >
                            {r.sessionId ? `${r.sessionId.slice(0, 8)}…` : "—"}
                          </span>
                        </td>
                      )}
                      {!hideSession && (
                        <td className="px-5 py-4">
                          <AgentBadge agent={r.agent} />
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export config slide-over */}
      <ExportPanel
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        rows={exportRows}
        rowNumber={rowNumber}
        exportingSelected={exportingSelected}
        isDemo={isDemo}
      />
    </>
  );
}
