"use client";

import { useEffect, useState } from "react";
import {
  getChatsStats,
  getDemoChatsStats,
  type ChatsStatsResult,
} from "@/lib/api";

function Spinner() {
  // Modern pulsating circle: a rippling ring around a steady core.
  return (
    <span
      role="status"
      aria-label="Loading"
      className="relative flex h-7 w-7 items-center justify-center"
    >
      <span className="absolute inline-flex h-7 w-7 animate-ping rounded-full bg-ink/15" />
      <span className="absolute inline-flex h-5 w-5 animate-pulse rounded-full bg-ink/25" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ink/70" />
    </span>
  );
}

// Stat cards with self-contained fetching/loading state. The parent supplies
// the sessions count (it already owns the session list) and bumps
// `refreshNonce` on Sync to force a re-fetch.
export default function StatsCards({
  isDemo,
  sessionsCount,
  refreshNonce = 0,
}: {
  isDemo: boolean;
  sessionsCount: number | null;
  refreshNonce?: number;
}) {
  const [stats, setStats] = useState<ChatsStatsResult | null>(null);

  useEffect(() => {
    let active = true;
    const force = refreshNonce > 0;
    setStats(null);
    const p = isDemo
      ? getDemoChatsStats(force)
      : getChatsStats({ forceRefresh: force });
    p.then((s) => active && setStats(s)).catch(() => { });
    return () => {
      active = false;
    };
  }, [isDemo, refreshNonce]);

  const cards = [
    { label: "Turns", value: stats ? String(stats.total) : null },
    { label: "Sessions", value: sessionsCount === null ? null : String(sessionsCount) },
    { label: "Tool calls", value: stats ? String(stats.toolCalls) : null },
    { label: "Distinct tools", value: stats ? String(stats.distinctTools) : null },
  ];

  return (
    <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 shadow-material sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((s) => (
        <div key={s.label} className="bg-white p-5">
          <div className="font-display text-3xl">
            {s.value === null ? <Spinner /> : s.value}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
            {s.value !== null ? s.label : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
