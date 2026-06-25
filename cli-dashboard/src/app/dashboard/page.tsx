"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import SessionCard from "@/components/SessionCard";
import SessionCardSkeleton from "@/components/SessionCardSkeleton";
import SessionGroupModal from "@/components/SessionGroupModal";
import WeekSection from "@/components/WeekSection";
import Insights from "@/components/Insights";
import {
  ApiError,
  getChatsSummary,
  getDemoChatsSummary,
  isAuthenticated,
  sessionLabel,
  sessionName,
  type SessionGroup,
  type SessionMap,
} from "@/lib/api";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Local midnight of the Monday that starts the week containing `ms`. */
function weekStartMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - mondayOffset);
  return d.getTime();
}

function weekLabel(key: number, currentWeek: number): string {
  if (key < 0) return "Undated";
  if (key === currentWeek) return "This week";
  if (key === currentWeek - WEEK_MS) return "Last week";
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(new Date(key))} – ${fmt(new Date(key + 6 * 24 * 60 * 60 * 1000))}`;
}

type WeekGroup = {
  key: number;
  label: string;
  defaultOpen: boolean;
  sessions: (SessionGroup & {
    groupSessions?: { sessionId: string; name: string; agent?: string }[];
    groupName?: string;
  })[];
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);

  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [sessionMap, setSessionMap] = useState<SessionMap>([]);
  const [groups, setGroups] = useState<{ name: string; session_list: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const loadChats = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!isDemo && !isAuthenticated()) {
        router.replace("/auth");
        return;
      }
      if (mode === "refresh") {
        setRefreshing(true);
      }
      setError(null);
      try {
        const force = mode === "refresh";
        const data = isDemo
          ? await getDemoChatsSummary(force)
          : await getChatsSummary({ forceRefresh: force });
        setSessions(data.sessions);
        setSessionMap(data.sessionMap);
        setGroups(data.groups ?? []);
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

  const sessionHref = (sid: string) =>
    `/dashboard/session/${encodeURIComponent(sid)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
    }`;

  const groupHref = (gname: string) =>
    `/dashboard/group/${encodeURIComponent(gname)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
    }`;

  const insightsHref = `/dashboard/insights${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
    }`;

  const busy = loading || refreshing;

  const displaySessions = useMemo(() => {
    const sessionToGroup = new Map<string, typeof groups[0]>();
    for (const g of groups) {
      for (const sid of g.session_list) {
        sessionToGroup.set(sid, g);
      }
    }

    const seenGroups = new Set<string>();
    const result: (SessionGroup & { groupSessions?: { sessionId: string; name: string; agent?: string }[], groupName?: string })[] = [];

    for (const s of sessions) {
      const group = sessionToGroup.get(s.sessionId);
      if (group) {
        if (!seenGroups.has(group.name)) {
          seenGroups.add(group.name);
          const gSessions = group.session_list.map((sid) => {
            const ss = sessions.find(x => x.sessionId === sid);
            return {
              sessionId: sid,
              name: sessionName(sessionMap, sid),
              agent: ss?.agent,
            };
          });
          result.push({
            sessionId: group.session_list[0] || s.sessionId,
            latestTs: s.latestTs,
            count: group.session_list.reduce((acc, sid) => acc + (sessions.find(x => x.sessionId === sid)?.count || 0), 0),
            groupName: group.name,
            groupSessions: gSessions,
          });
        }
      } else {
        result.push(s);
      }
    }
    return result;
  }, [sessions, groups, sessionMap]);

  // Group sessions into weeks (most recent first); only the current week is
  // open by default — or the latest week if there's nothing in the current one.
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const currentWeek = weekStartMs(Date.now());
    const buckets = new Map<number, SessionGroup[]>();
    for (const s of displaySessions) {
      const t = Date.parse(s.latestTs);
      const key = Number.isNaN(t) ? -1 : weekStartMs(t);
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(s);
    }
    const keys = [...buckets.keys()].sort((a, b) =>
      a === -1 ? 1 : b === -1 ? -1 : b - a
    );
    const resultGroups = keys.map((key) => ({
      key,
      label: weekLabel(key, currentWeek),
      defaultOpen: key === currentWeek,
      sessions: buckets.get(key)!,
    }));
    if (resultGroups.length && !resultGroups.some((g) => g.defaultOpen)) {
      resultGroups[0].defaultOpen = true; // fallback: open the most recent week
    }
    return resultGroups;
  }, [displaySessions]);

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

        {/* Latest Insights */}
        {!busy && (
          <div className="mt-8">
            <Insights 
              scope="global" 
              isDemo={isDemo} 
              mode="latest" 
              chatCount={sessions.reduce((acc, s) => acc + s.count, 0)} 
            />
          </div>
        )}

        {/* Sessions */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Sessions</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGroupModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
                Manage sessions
              </button>
              <Link
                href={insightsHref}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
                Past AI insights →
              </Link>
              <button
                type="button"
                onClick={() => loadChats("refresh")}
                disabled={busy}
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
          </div>

          {loading ? (
            <p className="rounded-2xl border border-ink/10 bg-white px-5 py-10 text-center text-ink-muted shadow-material">
              Loading…
            </p>
          ) : error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center text-red-600">
              {error}
            </p>
          ) : refreshing ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: Math.max(sessions.length, 6) }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white px-5 py-10 text-center text-ink-muted shadow-material">
              No sessions yet.
            </p>
          ) : (
            <div className="space-y-1">
              {weekGroups.map((g) => (
                <WeekSection
                  key={g.key}
                  label={g.label}
                  count={g.sessions.length}
                  defaultOpen={g.defaultOpen}
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {g.sessions.map((s) => (
                      <SessionCard
                        key={s.groupName ? `group-${s.groupName}` : s.sessionId}
                        sessionId={s.sessionId}
                        latestTimestamp={s.latestTs}
                        href={s.groupName ? groupHref(s.groupName) : sessionHref(s.sessionId)}
                        name={s.groupName || sessionName(sessionMap, s.sessionId)}
                        label={sessionLabel(sessionMap, s.sessionId)}
                        agent={s.agent}
                        groupSessions={s.groupSessions}
                      />
                    ))}
                  </div>
                </WeekSection>
              ))}
            </div>
          )}
        </div>
      </div>
      <SessionGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        sessions={sessions}
        sessionMap={sessionMap}
        groups={groups}
        onUpdate={() => loadChats("refresh")}
        isDemo={isDemo}
      />
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
