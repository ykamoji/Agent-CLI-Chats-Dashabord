"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import UserMenu from "@/components/common/layout/UserMenu";
import SessionCard from "@/components/common/cards/SessionCard";
import SessionCardSkeleton from "@/components/common/cards/SessionCardSkeleton";
import WeekSection from "@/components/common/layout/WeekSection";
import Insights from "@/components/common/insights/Insights";
import {
  ApiError,
  getChatsSummary,
  getDemoChatsSummary,
  getStoredUser,
  isAuthenticated,
  sessionLabel,
  sessionName,
  updateSessionGroup,
  type SessionGroup,
  type SessionMap,
} from "@/lib/api";
import GroupSessionHeader from "@/components/group/GroupSessionHeader";
import AddSessionsToGroupModal from "@/components/group/AddSessionsToGroupModal";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekStartMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7;
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
  sessions: SessionGroup[];
};

function GroupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const groupName = decodeURIComponent((params?.groupName as string) || "");

  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);

  const user = getStoredUser();
  const isAdmin = user?.role === "admin";

  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [sessionMap, setSessionMap] = useState<SessionMap>([]);
  const [groups, setGroups] = useState<{ name: string; session_list: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);

  const ungroupedSessions = useMemo(() => {
    const groupedIds = new Set<string>();
    for (const g of groups) {
      for (const sid of g.session_list) groupedIds.add(sid);
    }
    return sessions.filter((s) => !groupedIds.has(s.sessionId));
  }, [sessions, groups]);

  const loadChats = useCallback(
    async () => {
      if (!isDemo && !isAuthenticated()) {
        router.replace("/auth");
        return;
      }
      try {
        const data = isDemo
          ? await getDemoChatsSummary(false)
          : await getChatsSummary({ forceRefresh: false });
        setSessions(data.sessions);
        setSessionMap(data.sessionMap);
        setGroups(data.groups ?? []);
      } catch (err) {
        if (!isDemo && err instanceof ApiError && err.status === 401) {
          router.replace("/auth");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load group chats.");
      } finally {
        setLoading(false);
      }
    },
    [isDemo, router]
  );

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const groupSessions = useMemo(() => {
    const groupDef = groups.find((g) => g.name === groupName);
    if (!groupDef) return [];
    const set = new Set(groupDef.session_list);
    return sessions.filter((s) => set.has(s.sessionId));
  }, [sessions, groups, groupName]);

  const weekGroups = useMemo<WeekGroup[]>(() => {
    const currentWeek = weekStartMs(Date.now());
    const buckets = new Map<number, SessionGroup[]>();
    for (const s of groupSessions) {
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
      resultGroups[0].defaultOpen = true;
    }
    return resultGroups;
  }, [groupSessions]);

  const dashboardHref = `/dashboard${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""}`;

  const sessionHref = (sid: string) =>
    `/dashboard/session/${encodeURIComponent(sid)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
    }`;

  const handleRenameGroup = async (newName: string) => {
    if (!newName.trim() || newName === groupName) return;
    const sessionIds = groupSessions.map(s => s.sessionId);
    await updateSessionGroup(sessionIds, newName, isDemo);
    router.replace(`/dashboard/group/${encodeURIComponent(newName)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""}`);
  };

  const handleRemoveSelected = async () => {
    if (selectedSessionIds.size === 0) return;
    await updateSessionGroup(Array.from(selectedSessionIds), "", isDemo);
    setSelectionEnabled(false);
    setSelectedSessionIds(new Set());
    await loadChats();
  };

  const handleToggleSession = (sessionId: string, selected: boolean) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(sessionId);
      else next.delete(sessionId);
      return next;
    });
  };

  const handleCancelSelection = () => {
    setSelectionEnabled(false);
    setSelectedSessionIds(new Set());
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-paper">
                &gt;_
              </span>
            </Link>
            <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <Link href={dashboardHref} className="text-ink-muted transition-colors hover:text-ink">
                Dashboard
              </Link>
              <span className="text-ink-muted">/</span>
              <span>{groupName}</span>
            </div>
          </div>
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
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
          >
            ← Back to dashboard
          </Link>
        </div>

        <GroupSessionHeader
          groupName={groupName}
          sessionsCount={groupSessions.length}
          onRenameGroup={handleRenameGroup}
          selectionEnabled={selectionEnabled}
          onEnableSelection={() => setSelectionEnabled(true)}
          onCancelSelection={handleCancelSelection}
          onRemoveSelected={handleRemoveSelected}
          selectedCount={selectedSessionIds.size}
          onAddSessionsClick={() => setAddModalOpen(true)}
          isAdmin={isAdmin}
        />

        <div className="mt-6">
          {!loading && groupSessions.length > 0 && (
            <Insights
              scope="group"
              groupName={groupName}
              sessionIds={groupSessions.map(s => s.sessionId)}
              isDemo={isDemo}
              mode="latest"
              chatCount={groupSessions.reduce((acc, s) => acc + s.count, 0)}
            />
          )}
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center text-red-600">
              {error}
            </p>
          ) : groupSessions.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white px-5 py-10 text-center text-ink-muted shadow-material">
              No sessions found in this group.
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
                        key={s.sessionId}
                        sessionId={s.sessionId}
                        latestTimestamp={s.latestTs}
                        href={sessionHref(s.sessionId)}
                        name={sessionName(sessionMap, s.sessionId)}
                        label={sessionLabel(sessionMap, s.sessionId)}
                        agent={s.agent}
                        selectable={selectionEnabled}
                        selected={selectedSessionIds.has(s.sessionId)}
                        onToggle={(selected) => handleToggleSession(s.sessionId, selected)}
                        count={s.count}
                      />
                    ))}
                  </div>
                </WeekSection>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddSessionsToGroupModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        ungroupedSessions={ungroupedSessions}
        sessionMap={sessionMap}
        groupName={groupName}
        isDemo={isDemo}
        onUpdate={loadChats}
      />
    </main>
  );
}

export default function GroupPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-paper text-ink">
          <p className="text-ink-muted">Loading…</p>
        </main>
      }
    >
      <GroupContent />
    </Suspense>
  );
}
