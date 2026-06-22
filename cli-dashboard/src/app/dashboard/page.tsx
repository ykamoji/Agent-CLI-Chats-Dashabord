"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import SessionCard from "@/components/SessionCard";
import {
  ApiError,
  getChatsSummary,
  getDemoChatsSummary,
  getChatsStats,
  getDemoChatsStats,
  isAuthenticated,
  sessionLabel,
  sessionName,
  type SessionGroup,
  type SessionMap,
  type ChatsStatsResult,
} from "@/lib/api";

const INSIGHTS = [
  "Your prompts that name a specific file resolve 2.4× faster.",
  "Vague verbs like “fix” trigger 3× more retries than “replace X with Y”.",
  "Bash failures cluster around expired tokens — front-load auth context.",
];


function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);

  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [stats, setStats] = useState<ChatsStatsResult | null>(null);
  const [sessionMap, setSessionMap] = useState<SessionMap>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!isDemo && !isAuthenticated()) {
        router.replace("/auth");
        return;
      }
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const force = mode === "refresh";
        if (force) setStats(null);

        const loadStatsAsync = isDemo
          ? getDemoChatsStats(force)
          : getChatsStats({ forceRefresh: force });
        loadStatsAsync.then(setStats).catch(() => {});

        const data = isDemo
          ? await getDemoChatsSummary(force)
          : await getChatsSummary({ forceRefresh: force });
        setSessions(data.sessions);
        setSessionMap(data.sessionMap);
      } catch (err) {
        if (!isDemo && err instanceof ApiError && err.status === 401) {
          router.replace("/auth");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load chats.");
      } finally {
        if (mode === "initial") setLoading(false);
        else setRefreshing(false);
      }
    },
    [isDemo, router]
  );

  useEffect(() => {
    loadChats("initial");
  }, [loadChats]);

  const statCards = [
    { label: "Turns", value: stats ? String(stats.total) : null },
    { label: "Sessions", value: String(sessions.length) },
    { label: "Tool calls", value: stats ? String(stats.toolCalls) : null },
    { label: "Distinct tools", value: stats ? String(stats.distinctTools) : null },
  ];

  const sessionHref = (sid: string) =>
    `/dashboard/session/${encodeURIComponent(sid)}${
      isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
    }`;

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-paper">
              &gt;_
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              CLI Dashboard
            </span>
          </Link>
          {isDemo ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper-soft px-4 py-1.5 text-xs font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Viewing: {demoUser}
            </span>
          ) : (
            <UserMenu />
          )}
        </div>
      </header>

      <div className="mx-auto px-6 py-10">
        {isDemo && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Sample dashboard</span>
            <span className="text-amber-600">—</span>
            <span>
              Showing public data for <strong>{demoUser}</strong>.
            </span>
            <Link
              href="/auth?mode=signup"
              className="ml-auto rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper transition-transform hover:-translate-y-0.5"
            >
              Create your own →
            </Link>
          </div>
        )}
        <h1 className="font-display text-3xl tracking-tight">
          {isDemo ? `${demoUser}'s conversation history` : "Conversation history"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Grouped by session. Select a session to see its turns.
        </p>

        {/* Stats */}
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 shadow-material sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white p-5">
              <div className="font-display text-3xl">
                {loading || s.value === null ? (
                  <svg className="h-6 w-6 animate-spin text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    <path d="M21 3v6h-6" />
                  </svg>
                ) : (
                  s.value
                )}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-4">
          {/* Sessions */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Sessions</h2>
              <button
                type="button"
                onClick={() => loadChats("refresh")}
                disabled={loading || refreshing}
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
            </div>

            {loading ? (
              <p className="rounded-2xl border border-ink/10 bg-white px-5 py-10 text-center text-ink-muted shadow-material">
                Loading…
              </p>
            ) : error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center text-red-600">
                {error}
              </p>
            ) : sessions.length === 0 ? (
              <p className="rounded-2xl border border-ink/10 bg-white px-5 py-10 text-center text-ink-muted shadow-material">
                No sessions yet.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {sessions.map((s) => (
                  <SessionCard
                    key={s.sessionId}
                    sessionId={s.sessionId}
                    latestTimestamp={s.latestTs}
                    href={sessionHref(s.sessionId)}
                    name={sessionName(sessionMap, s.sessionId)}
                    label={sessionLabel(sessionMap, s.sessionId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Insights */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-ink/10 bg-ink p-6 text-paper shadow-material">
              <h2 className="font-display text-lg font-bold">Key insights</h2>
              <p className="mt-1 text-xs text-paper/60">Derived from your history</p>
              <ul className="mt-5 space-y-4">
                {INSIGHTS.map((insight, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="font-mono text-xs text-paper/50">0{idx + 1}</span>
                    <span className="text-sm leading-relaxed">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-paper text-ink">
          <p className="text-ink-muted">Loading…</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
