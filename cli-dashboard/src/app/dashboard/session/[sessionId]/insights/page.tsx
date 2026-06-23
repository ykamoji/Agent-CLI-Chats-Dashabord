"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import Insights from "@/components/Insights";

function SessionInsightsContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();

  const rawId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;
  const sessionId = decodeURIComponent(rawId ?? "");

  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);
  const backHref = `/dashboard/session/${encodeURIComponent(sessionId)}${isDemo ? `?demo=${encodeURIComponent(demoUser as string)}` : ""
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
        {/* Back */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
        >
          ← Back to session
        </Link>

        <h1 className="mt-6 font-display text-3xl tracking-tight">Session insights</h1>
        <p className="mt-1 break-all font-mono text-xs text-ink-muted">
          {sessionId || "—"}
        </p>

        <div className="mt-6">
          <Insights scope="session" sessionId={sessionId} isDemo={isDemo} />
        </div>
      </div>
    </main>
  );
}

export default function SessionInsightsPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-paper text-ink">
          <p className="text-ink-muted">Loading…</p>
        </main>
      }
    >
      <SessionInsightsContent />
    </Suspense>
  );
}
