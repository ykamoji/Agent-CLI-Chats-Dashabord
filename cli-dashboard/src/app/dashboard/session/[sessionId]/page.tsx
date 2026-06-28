"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Header from "@/components/common/layout/Header";
import ChatTable from "@/components/session/table/ChatTable";
import TurnDetailPanel from "@/components/session/detail/TurnDetailPanel";
import SessionHeader from "@/components/session/header/SessionHeader";
import Insights from "@/components/common/insights/Insights";
import { deleteChats, getStoredUser } from "@/lib/api";
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

  const user = getStoredUser();
  const isAdmin = user?.role === "admin";

  const {
    chats,
    sessionMap,
    loading,
    refreshing,
    error,
    reload,
    applySessionMap,
    removeChats,
    patchChatBookmark,
  } = useSessionChats(sessionId, isDemo);

  const panel = useDetailPanel();

  const [bookmarkOnly, setBookmarkOnly] = useState(false);

  const visibleChats = useMemo(
    () =>
      bookmarkOnly ? chats.filter((c) => Boolean(c.bookmark?.enabled)) : chats,
    [chats, bookmarkOnly]
  );

  const groupName = sessionMap.find((e) => e.session_id === sessionId)?.group?.name;
  const sName = sessionMap.find((e) => e.session_id === sessionId)?.name || sessionId;

  const dashboardHref = `/dashboard${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""}`;
  const groupHref = groupName
    ? `/dashboard/group/${encodeURIComponent(groupName)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
    }`
    : undefined;

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <Header
        isDemo={isDemo}
        demoUser={demoUser}
        breadcrumbs={[
          { label: "Dashboard", href: dashboardHref },
          ...(groupName ? [{ label: groupName, href: groupHref }] : []),
          { label: sName, truncate: true },
        ]}
      />

      <div
        className={`px-6 py-10 transition-[margin] duration-300 ease-out ${panel.open ? "lg:mr-[50vw]" : ""
          }`}
      >
        {/* Back + insights */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={groupHref || dashboardHref}
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
          >
            ← Back to {groupHref ? `group ${groupName}` : "dashboard"}
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

        {/* Latest Insights */}
        {!loading && !error && (
          <div className="mt-6">
            <Insights scope="session" sessionId={sessionId} isDemo={isDemo} mode="latest" chatCount={chats.length} />
          </div>
        )}

        {/* Conversations table (session column removed) */}
        <div className="mt-6">
          <ChatTable
            chats={visibleChats}
            loading={loading}
            error={error}
            hideSession
            title="Conversations"
            isDemo={isDemo}
            bookmarkOnly={bookmarkOnly}
            onBookmarkOnlyChange={setBookmarkOnly}
            onRefresh={reload}
            refreshing={refreshing}
            selectedId={panel.open ? panel.selected?.row.id ?? null : null}
            onRowClick={panel.handleRowClick}
            onDelete={isAdmin ? async (selectedRawChats) => {
              removeChats(selectedRawChats); // optimistic
              const records = selectedRawChats.map((raw) => ({
                entry_index: raw.entry_index,
                session_id: raw.session_id,
                cli_agent: raw.cli_agent,
                user_id: raw.user_id,
              }));
              await deleteChats(records, isDemo);
              reload();
            } : undefined}
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
        onBookmarkSaved={patchChatBookmark}
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
