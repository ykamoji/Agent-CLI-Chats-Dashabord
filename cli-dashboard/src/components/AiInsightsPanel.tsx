"use client";

import { useEffect, useRef, useState } from "react";
import { type InsightsDoc } from "@/lib/api";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-paper/60">
        {title}
      </p>
      <ul className="mt-2 space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3">
            <span className="font-mono text-xs text-paper/50">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AiInsightsPanel({
  doc,
  scope,
}: {
  doc: InsightsDoc;
  scope: "global" | "session" | "group";
}) {
  const [aiOpen, setAiOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasCompleteData = doc.status === "complete";

  // Collapse when complete data arrives for the first time
  useEffect(() => {
    if (hasCompleteData) setAiOpen(false);
  }, [hasCompleteData]);

  return (
    <div className="rounded-2xl border border-ink/10 bg-ink p-6 text-paper shadow-material">
      <div
        className={`flex items-start justify-between gap-3${hasCompleteData ? " cursor-pointer select-none" : ""
          }`}
        onClick={() => hasCompleteData && setAiOpen((o) => !o)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold">AI insights</h2>
            {hasCompleteData && (
              <svg
                className={`h-4 w-4 shrink-0 text-paper/50 transition-transform duration-300 ${aiOpen ? "rotate-180" : ""
                  }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>
          <p className="mt-1 text-xs text-paper/60">
            {scope === "session" ? "For this session" : "Across your history"} · powered by Gemini
          </p>
          {doc.status === "complete" && doc.reasoning && (<>
            <p className="mt-2 border-t border-paper/10 pt-3 text-xs italic text-paper/50">
              {doc.reasoning}
            </p>
            <p className="text-[10px] pt-1 text-paper/40">
              {doc.logs_used_count} turns analyzed ·{" "}
              {new Date(doc.timestamp).toLocaleString()}
            </p>
          </>
          )}
        </div>
      </div>

      {/* Collapsible content area */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: aiOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 350ms ease",
        }}
      >
        <div className="overflow-hidden">
          <div ref={contentRef} className="mt-5">
            {doc.status === "complete" ? (
              <div className="space-y-5">
                <List title="Insights" items={doc.insights} />
                <List title="Prompt recommendations" items={doc.recommendations} />
                <List title="Anomalies" items={doc.anomalies} />
              </div>
            ) : doc.status === "error" ? (
              <p className="text-sm text-red-300">
                Generation failed{doc.error ? `: ${doc.error}` : "."} Try again.
              </p>
            ) : doc.status === "pending" ? (
              <p className="text-sm text-paper/70">Analyzing your conversation history…</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
