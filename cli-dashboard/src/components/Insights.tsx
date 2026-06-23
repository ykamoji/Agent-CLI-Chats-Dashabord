"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateInsights,
  getInsights,
  type InsightsMetrics,
  type InsightsResponse,
} from "@/lib/api";
import AiInsightsPanel from "./AiInsightsPanel";

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
  isDemo = false,
}: {
  scope: "global" | "session";
  sessionId?: string;
  isDemo?: boolean;
}) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await getInsights({ scope, sessionId, demo: isDemo });
      if (mounted.current) setData(r);
    } catch {
      if (mounted.current) setError("Could not load insights.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [scope, sessionId, isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  const onGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateInsights({ scope, sessionId, force: true });
      const start = Date.now();
      // Poll until the background job finishes (or we time out).
      while (mounted.current && Date.now() - start < 60_000) {
        await sleep(2000);
        const r = await getInsights({ scope, sessionId, demo: isDemo });
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
  }, [scope, sessionId, isDemo]);

  const docs = data?.docs ?? [];
  const modelAvailable = data?.modelAvailable ?? false;
  const hasPending = docs.some((d) => d.status === "pending");
  const busy = generating || hasPending;
  const canGenerate = !isDemo && modelAvailable;

  return (
    <div className="space-y-6">
      {/* Deterministic, always-on */}
      {loading ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-5 py-8 text-center text-sm text-ink-muted shadow-material">
          Loading…
        </p>
      ) : (
        data && <DeterministicPanel m={data.metrics} />
      )}

      {/* Generate button + status messages */}
      <div className="flex items-center gap-3">
        {canGenerate && (
          <GenerateButton busy={busy} hasExisting={docs.length > 0} onGenerate={onGenerate} />
        )}
        {!loading && !modelAvailable && (
          <p className="text-xs text-ink-muted">
            AI insights are off. Set <span className="font-mono">GOOGLE_API_KEY</span> on the server to enable them.
          </p>
        )}
        {!loading && isDemo && docs.length === 0 && (
          <p className="text-xs text-ink-muted">
            Log in to generate AI insights for your own history.
          </p>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* AI insight cards (descending order) */}
      {!loading && docs.length === 0 && modelAvailable && !isDemo && !generating && (<>
        <div className="rounded-2xl bg-ink text-paper p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold">AI insights</h2>
          </div>
          <p className="mt-1 text-xs text-paper/60">
            {scope === "session" ? "For this session" : "Across your history"} · powered by Gemini
          </p>
        </div>
        <p className="px-5 py-4 text-center text-sm text-ink-muted">
          No insights yet. {canGenerate && (<><GenerateButton busy={busy} hasExisting={false} onGenerate={onGenerate} /> to analyze your history.</>)}
        </p>
      </>)}
      {docs.map((doc, i) => (
        <AiInsightsPanel key={doc.timestamp ?? i} doc={doc} scope={scope} />
      ))}
    </div>
  );
}
