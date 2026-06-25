"use client";

import { useState } from "react";
import { fmtArgs, type ToolUse } from "@/lib/chats";

// A single tool call. Collapsed by default: shows only the index and tool name.
// Clicking the bar slides the Arguments + Result into view.
export default function ToolCard({ tool, index }: { tool: ToolUse; index: number }) {
  const [open, setOpen] = useState(false);
  const hasDetail = tool.arguments != null || Boolean(tool.result);

  return (
    <div className="overflow-hidden rounded-lg border border-ink/10 bg-paper-soft/40">
      {/* Bar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!hasDetail}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-paper-soft disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="font-mono text-[10px] text-ink-muted">#{index + 1}</span>
        <span className="rounded bg-ink px-2 py-0.5 font-mono text-xs text-paper">
          {tool.tool || "tool"}
        </span>
        {hasDetail && (
          <svg
            className={`ml-auto h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Sliding body (grid-rows trick animates to auto height) */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 px-3 pb-3">
            {tool.arguments != null && (
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  Arguments
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono text-xs">
                  {fmtArgs(tool.arguments)}
                </pre>
              </div>
            )}
            {tool.result && (
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  Result
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono text-xs text-ink-muted">
                  {tool.result}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
