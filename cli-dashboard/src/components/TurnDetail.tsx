"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ToolCard from "@/components/ToolCard";
import { type Row, type ToolUse } from "@/lib/chats";
import { getTurnTools } from "@/lib/api";

// Presentational detail for a single Conversation: Input + the individual tool calls,
// styled exactly like the previous inline "expanded row" view. Reused by the
// slide-over detail panel.
export default function TurnDetail({ row }: { row: Row }) {
  const searchParams = useSearchParams();
  const isDemo = Boolean(searchParams.get("demo"));

  const [tools, setTools] = useState<ToolUse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (row.toolCount > 0) {
      setLoading(true);
      getTurnTools(row.sessionId, row.entryIndex, isDemo)
        .then((data) => setTools(data as ToolUse[]))
        .catch(() => setTools([]))
        .finally(() => setLoading(false));
    } else {
      setTools([]);
    }
  }, [row, isDemo]);
  return (
    <div className="space-y-3">
      {/* Input */}
      <div className="rounded-lg border border-ink/10 bg-white p-3">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Input
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-paper-soft p-2 font-mono text-xs">
          {row.input || "—"}
        </pre>
      </div>

      {/* Output (may be absent on errors) */}
      {row.output && (
        <div className="rounded-lg border border-ink/10 bg-white p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Output
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-paper-soft p-2 font-mono text-xs">
            {row.output}
          </pre>
        </div>
      )}

      {/* Tools */}
      <div className="rounded-lg border border-ink/10 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Tools Used
          {row.toolCount > 0 && (
            <span className="font-mono normal-case">({row.toolCount})</span>
          )}
        </div>
        {row.toolCount === 0 ? (
          <p className="text-xs text-ink-muted">No tools used in this Conversation.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Loading tools...
          </div>
        ) : (
          <div className="space-y-2">
            {tools.map((t, ti) => (
              <ToolCard key={ti} tool={t} index={ti} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
