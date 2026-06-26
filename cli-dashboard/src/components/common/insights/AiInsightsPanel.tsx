"use client";

import { useEffect, useRef, useState } from "react";
import { type InsightsDoc } from "@/lib/api";

function BentoSection({
  title,
  items,
  type
}: {
  title: string;
  items: string[];
  type: "info" | "success" | "warning"
}) {
  if (!items || items.length === 0) return null;

  const borderStyles = {
    info: "border-l-blue-500",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500"
  };

  const iconStyles = {
    info: "text-blue-400",
    success: "text-emerald-400",
    warning: "text-amber-400"
  };

  const Icon = () => {
    if (type === "info") return (
      <svg className={`h-4 w-4 ${iconStyles.info}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    );
    if (type === "success") return (
      <svg className={`h-4 w-4 ${iconStyles.success}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    );
    return (
      <svg className={`h-4 w-4 ${iconStyles.warning}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Icon />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-paper/80">
          {title}
        </h3>
      </div>
      <div className="grid gap-3 flex-1 content-start">
        {items.map((it, i) => (
          <div key={i} className={`rounded-xl bg-white/5 border border-white/5 border-l-4 p-4 ${borderStyles[type]}`}>
            <p className="text-sm leading-relaxed text-paper/80">{it}</p>
          </div>
        ))}
      </div>
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
  const [aiOpen, setAiOpen] = useState(false);
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
            <h2 className="font-display text-lg font-bold">Insights</h2>
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
          {doc.status === "pending" && <p className="text-xs mt-3 pt-3 text-paper/70">Analyzing your conversation history…</p>}
          {hasCompleteData && doc.reasoning && (<>
            <p className="mt-3 pt-3 border-t border-paper/10 text-[13px] italic text-paper/50">
              {doc.reasoning}
            </p>
            <p className="text-[12px] pt-2 text-paper/80">
              {doc.logs_used_count} Conversations analyzed ·{" "}
              {new Date(doc.timestamp).toLocaleString()}
            </p>
          </>
          )}
          {doc.status === "error" && <p className="text-xs mt-4 text-red-300">
            Generation failed{doc.error ? `: ${doc.error}` : "."} Try again.
          </p>}
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
            <div className="flex flex-col gap-6">
              <div>
                <BentoSection title="Prompt recommendations" items={doc.recommendations} type="success" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <BentoSection title="Insights" items={doc.insights} type="info" />
                <BentoSection title="Anomalies" items={doc.anomalies} type="warning" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
