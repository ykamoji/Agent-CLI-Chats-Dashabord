"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import ChatTable from "@/components/ChatTable";
import TurnDetailPanel from "@/components/TurnDetailPanel";
import SessionHeader from "@/components/SessionHeader";
import { deleteChats } from "@/lib/api";
import { useSessionChats } from "@/lib/useSessionChats";
import { useDetailPanel } from "@/lib/useDetailPanel";

function SessionContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();

  const rawId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;
  const sessionId = decodeURIComponent(rawId ?? "");

  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);
  const insightsHref = `/dashboard/session/${encodeURIComponent(sessionId)}/insights${
    isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
  }`;

  const {
    chats,
    sessionMap,
    loading,
    refreshing,
    error,
    reload,
    applySessionMap,
    removeChats,
  } = useSessionChats(sessionId, isDemo);

  const panel = useDetailPanel();

  const groupName = sessionMap.find((e) => e.session_id === sessionId)?.group?.name;
  const sName = sessionMap.find((e) => e.session_id === sessionId)?.name || sessionId;
  
  const dashboardHref = `/dashboard${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""}`;
  const groupHref = groupName
    ? `/dashboard/group/${encodeURIComponent(groupName)}${
        isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
      }`
    : undefined;

  const backHref = groupName
    ? groupHref!
    : dashboardHref;

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
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
              {groupName && (
                <>
                  <Link href={groupHref!} className="text-ink-muted transition-colors hover:text-ink">
                    {groupName}
                  </Link>
                  <span className="text-ink-muted">/</span>
                </>
              )}
              <span className="truncate max-w-[200px] sm:max-w-[300px]" title={sName}>
                {sName}
              </span>
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

      <div
        className={`px-6 py-10 transition-[margin] duration-300 ease-out ${
          panel.open ? "lg:mr-[50vw]" : ""
        }`}
      >
        {/* Back + insights */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
          >
            ← Back to {groupName ? groupName : "sessions"}
          </Link>
          <Link
            href={insightsHref}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink shadow-material transition-colors hover:bg-paper-soft"
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
            Key insights →
          </Link>
        </div>

        {/* Unified session id + editable name + label */}
        <SessionHeader
          sessionId={sessionId}
          isDemo={isDemo}
          sessionMap={sessionMap}
          onSessionMapChange={applySessionMap}
          turnsCount={chats.length}
          showTurns={!loading && !error}
          agent={chats[0]?.cli_agent as string | undefined}
        />

        {/* Turns table (session column removed) */}
        <div className="mt-6">
          <ChatTable
            chats={chats}
            loading={loading}
            error={error}
            hideSession
            title="Turns"
            isDemo={isDemo}
            onRefresh={reload}
            refreshing={refreshing}
            selectedId={panel.open ? panel.selected?.row.id ?? null : null}
            onRowClick={panel.handleRowClick}
            onDelete={async (selectedRawChats) => {
              removeChats(selectedRawChats); // optimistic
              const records = selectedRawChats.map((raw) => ({
                entry_index: raw.entry_index,
                session_id: raw.session_id,
                cli_agent: raw.cli_agent,
                user_id: raw.user_id,
              }));
              await deleteChats(records, isDemo);
              reload();
            }}
          />
        </div>
      </div>

      {/* Slide-over detail panel */}
      <TurnDetailPanel
        row={panel.selected?.row ?? null}
        rowNumber={panel.selected?.num}
        agent={panel.selected?.row.agent}
        open={panel.open}
        onClose={panel.close}
        onReopen={panel.reopen}
      />
    </main>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-paper text-ink">
          <p className="text-ink-muted">Loading…</p>
        </main>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
