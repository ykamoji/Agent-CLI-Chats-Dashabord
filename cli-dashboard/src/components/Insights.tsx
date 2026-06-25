"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateInsights,
  getInsights,
  type InsightsMetrics,
  type InsightsResponse,
} from "@/lib/api";
import DeterministicPanel from "@/components/DeterministicPanel";
import AiInsightsPanel from "@/components/AiInsightsPanel";
import SidePanel from "@/components/SidePanel";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3">
      <div className="font-display text-xl">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
    </div>
  );
}

function DeterministicPanel({ m }: { m: InsightsMetrics }) {
  if (!m || !m.total_turns) {
    return (
      <p className="rounded-2xl border border-ink/10 bg-white px-5 py-8 text-center text-sm text-ink-muted shadow-material">
        No data yet.
      </p>
    );
  }
  const pct = (v?: number) => (v == null ? "—" : `${v}%`);
  const cards: { label: string; value: string }[] = [
    { label: "Turns", value: String(m.total_turns) },
    m.session_shape
      ? { label: "Tools / turn", value: String(m.session_shape.tools_per_turn) }
      : { label: "Sessions", value: String(m.total_sessions ?? 0) },
    { label: "Tool calls", value: String(m.tool_calls ?? 0) },
    { label: "Tool error rate", value: pct(m.tool_error_rate) },
    { label: "Empty output", value: pct(m.empty_output_rate) },
    { label: "Specific prompts", value: pct(m.prompt_specificity_rate) },
    { label: "Vague prompts", value: pct(m.vague_prompt_rate) },
    { label: "Avg tools / turn", value: String(m.avg_tools_per_turn ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Metric key={c.label} {...c} />
        ))}
      </div>

      {m.top_tools && m.top_tools.length > 0 && (
        <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-material">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Top tools
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {m.top_tools.map((t) => (
              <span
                key={t.tool}
                className="inline-flex items-center gap-1.5 rounded-full bg-paper-soft px-3 py-1 text-xs"
              >
                <span className="font-mono">{t.tool}</span>
                <span className="text-ink-muted">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {m.anomalies && m.anomalies.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">
            Anomalies
          </p>
          <ul className="mt-2 space-y-1.5">
            {m.anomalies.map((a, i) => (
              <li key={i} className="text-sm text-amber-800">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GenerateButton({
  busy,
  hasExisting,
  onGenerate,
}: {
  busy: boolean;
  hasExisting: boolean;
  onGenerate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink/10 bg-ink px-4 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      )}
      {busy ? "Analyzing…" : hasExisting ? "Regenerate" : "Generate"}
    </button>
  );
}

export default function Insights({
  scope,
  sessionId,
  groupName,
  sessionIds,
  chatCount,
  isDemo = false,
  mode = "latest",
}: {
  scope: "global" | "session" | "group";
  sessionId?: string;
  groupName?: string;
  sessionIds?: string[];
  chatCount?: number;
  isDemo?: boolean;
  mode?: "latest" | "history";
}) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await getInsights({ scope, sessionId, groupName, sessionIds, chatCount, demo: isDemo });
      if (mounted.current) setData(r);
    } catch {
      if (mounted.current) setError("Could not load insights.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [scope, sessionId, groupName, sessionIds, chatCount, isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  const onGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateInsights({ scope, sessionId, groupName, sessionIds, force: true });
      const start = Date.now();
      // Poll until the background job finishes (or we time out).
      while (mounted.current && Date.now() - start < 60_000) {
        await sleep(2000);
        const r = await getInsights({ scope, sessionId, groupName, sessionIds, chatCount, forceRefresh: true, demo: isDemo });
        if (!mounted.current) return;
        setData(r);
        // Check if the newest doc is done
        const newest = r.docs?.[0];
        if (newest?.status === "complete" || newest?.status === "error") break;
      }
    } catch {
      if (mounted.current) setError("Could not generate insights.");
    } finally {
      if (mounted.current) setGenerating(false);
    }
  }, [scope, sessionId, groupName, sessionIds, chatCount, isDemo]);

  const docs = data?.docs ?? [];
  const modelAvailable = data?.modelAvailable ?? false;
  const hasPending = docs.some((d) => d.status === "pending");
  const busy = generating || hasPending;
  const canGenerate = !isDemo && modelAvailable;

  const pastDocs = docs.length > 1 ? docs.slice(1) : [];

  return (
    <div className="space-y-6">
      {mode === "latest" && (
        <>
          {/* Loading Animation or Button */}
          {loading ? (
            <div className="relative h-14 w-full overflow-hidden rounded-2xl bg-white border border-ink/5 flex items-center px-5 shadow-sm">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-shimmer" />
              <span className="relative flex items-center gap-3 text-sm font-medium text-ink-muted">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Analyzing conversations...
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-ink/5 shadow-sm gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPanelOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Gemini Insights ✨
                </button>
                <div className="flex flex-col">
                  {canGenerate && docs.length === 0 && !generating && (
                    <span className="text-xs text-ink-muted">No insights yet. Open panel to generate.</span>
                  )}
                  {!modelAvailable && (
                    <span className="text-xs text-ink-muted">AI insights disabled (missing GOOGLE_API_KEY).</span>
                  )}
                  {isDemo && docs.length === 0 && (
                    <span className="text-xs text-ink-muted">Log in to generate AI insights.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <SidePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} title="Insights Details">
            {data && <DeterministicPanel m={data.metrics} />}

            <div className="flex items-center justify-between mt-4">
              <h3 className="font-display text-lg font-bold">AI Analysis</h3>
              {canGenerate && (
                <GenerateButton busy={busy} hasExisting={docs.length > 0} onGenerate={onGenerate} />
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {docs.length === 0 && modelAvailable && !isDemo && !generating && (
              <div className="rounded-2xl border border-ink/10 bg-white p-6 text-center shadow-material mt-2">
                <p className="text-sm text-ink-muted">
                  No insights yet. Click the generate button to analyze your history.
                </p>
              </div>
            )}

            {docs.length > 0 && (
              <div className="mt-2">
                <AiInsightsPanel key={docs[0].timestamp ?? 0} doc={docs[0]} scope={scope} />
              </div>
            )}
          </SidePanel>
        </>
      )}

      {mode === "history" && (
        <>
          {loading ? (
            <div className="relative h-14 w-full overflow-hidden rounded-2xl bg-white border border-ink/5 flex items-center px-5 shadow-sm">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-shimmer" />
              <span className="relative flex items-center gap-3 text-sm font-medium text-ink-muted">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Analyzing conversations...
              </span>
            </div>
          ) : pastDocs.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white px-5 py-8 text-center text-sm text-ink-muted shadow-material">
              No past insights available.
            </p>
          ) : (
            pastDocs.map((doc, i) => (
              <AiInsightsPanel key={doc.timestamp ?? i} doc={doc} scope={scope} />
            ))
          )}
        </>
      )}
    </div>
  );
}
