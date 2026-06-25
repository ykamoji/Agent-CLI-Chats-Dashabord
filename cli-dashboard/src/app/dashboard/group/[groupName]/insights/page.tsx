"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import Insights from "@/components/Insights";
import { getChatsSummary, type SessionMap } from "@/lib/api";

function GroupInsightsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const groupName = decodeURIComponent((params?.groupName as string) || "");
  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);

  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getChatsSummary({ forceRefresh: false });
        const groupDef = data.groups?.find((g) => g.name === groupName);
        if (groupDef) {
          setSessionIds(groupDef.session_list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [groupName]);

  const dashboardHref = `/dashboard${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""}`;
  const backHref = `/dashboard/group/${encodeURIComponent(groupName)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""}`;

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
              <Link href={backHref} className="text-ink-muted transition-colors hover:text-ink">
                {groupName}
              </Link>
              <span className="text-ink-muted">/</span>
              <span>Insights</span>
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
        {/* Back */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
        >
          ← Back to {groupName}
        </Link>

        <h1 className="mt-6 font-display text-3xl tracking-tight">Past Group Insights</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Patterns surfaced from your sessions in {groupName}.
        </p>

        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-ink-muted">Loading group...</p>
          ) : sessionIds.length === 0 ? (
            <p className="text-sm text-ink-muted">No sessions found in this group.</p>
          ) : (
            <Insights 
              scope="group" 
              groupName={groupName} 
              sessionIds={sessionIds} 
              isDemo={isDemo} 
              mode="history" 
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function GroupInsightsPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-paper text-ink">
          <p className="text-ink-muted">Loading…</p>
        </main>
      }
    >
      <GroupInsightsContent />
    </Suspense>
  );
}
