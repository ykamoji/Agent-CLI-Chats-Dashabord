"use client";

import Link from "next/link";
import { useIsAuthenticated } from "@/lib/useAuth";

// Hero CTAs. When authenticated, the primary button links straight to the
// dashboard (no signup detour) and the "I already have an account" option is
// hidden. The Sample Dashboard link is always available.
export default function LandingHeroActions() {
  const authed = useIsAuthenticated();

  return (
    <div className="mt-10 flex animate-fade-up flex-col items-center gap-3 sm:flex-row">
      {authed ? (
        <Link
          href="/dashboard"
          className="rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-paper shadow-material-lg transition-transform hover:-translate-y-0.5"
        >
          Open my dashboard →
        </Link>
      ) : (
        <>
          <Link
            href="/auth?mode=signup"
            className="rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-paper shadow-material-lg transition-transform hover:-translate-y-0.5"
          >
            Open the dashboard →
          </Link>
          <Link
            href="/auth"
            className="rounded-full border border-ink/15 bg-white px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            I already have an account
          </Link>
        </>
      )}
      <Link
        href="/dashboard?demo=google_hackathon"
        className="rounded-full border border-ink/15 bg-white px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-soft"
      >
        Sample Dashboard ✦
      </Link>
    </div>
  );
}
