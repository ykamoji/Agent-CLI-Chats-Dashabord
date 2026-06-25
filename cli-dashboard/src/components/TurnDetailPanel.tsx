"use client";

import TurnDetail from "@/components/TurnDetail";
import { fmtTime, type Row } from "@/lib/chats";

// Slide-over panel anchored to the right edge. It slides in (leftward) when a
// Conversation is selected and slides back out (rightward) when closed. A small "<"
// bookmark tab on the edge re-opens it.
export default function TurnDetailPanel({
  row,
  rowNumber,
  agent,
  open,
  onClose,
  onReopen,
}: {
  row: Row | null;
  rowNumber?: number;
  agent?: string;
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
}) {
  const isClaude = (agent ?? "").toLowerCase().includes("claude");
  const agentLabel = isClaude
    ? "Claude"
    : (agent ?? "").toLowerCase().includes("anti")
      ? "Antigravity"
      : agent || "";

  return (
    <>
      {/* Bookmark tab: reopen the panel after it was closed. */}
      {!open && row && (
        <button
          type="button"
          onClick={onReopen}
          aria-label="Open details panel"
          className="group fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl border border-r-0 border-ink/15 bg-ink px-2 py-5 text-paper shadow-material transition-all hover:px-3"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 010 1.06L9.08 10l3.71 3.71a.75.75 0 11-1.06 1.06l-4.24-4.24a.75.75 0 010-1.06l4.24-4.24a.75.75 0 011.06 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] font-medium uppercase tracking-wide [writing-mode:vertical-rl]">
            Details
          </span>
        </button>
      )}

      {/* Slide-over panel */}
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-40 flex h-screen w-full flex-col border-l border-ink/15 bg-paper shadow-material transition-transform duration-300 ease-out lg:w-1/2 ${open ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Conversation details
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {rowNumber != null && (
                <span className="font-mono text-sm font-bold">#{rowNumber}</span>
              )}
              {row && (
                <span className="font-mono text-xs text-ink-muted">
                  {fmtTime(row.timestamp)}
                </span>
              )}
              {agentLabel && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${isClaude
                      ? "bg-ink text-paper"
                      : "border border-ink/20 bg-white text-ink"
                    }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isClaude ? "bg-paper" : "bg-ink"
                      }`}
                  />
                  {agentLabel}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details panel"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-ink/15 bg-white text-ink shadow-material transition-colors hover:bg-paper-soft"
          >
            {/* Arrow points right: panel slides off to the right. */}
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 010-1.06L10.92 10 7.21 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {row ? (
            <TurnDetail row={row} />
          ) : (
            <p className="text-sm text-ink-muted">
              Select a Conversation from the table to view its details.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
