"use client";

import Link from "next/link";
import { useIsAuthenticated } from "@/lib/useAuth";

// Right-side landing nav. Authenticated users skip the sign-in CTAs and get a
// direct link to their dashboard (clicking the logo no longer forces re-auth).
export default function LandingNav() {
  const authed = useIsAuthenticated();

  if (authed) {
    return (
      <nav className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-material transition-transform hover:-translate-y-0.5"
        >
          Open my dashboard →
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2">
      <Link
        href="/auth"
        className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        Sign in
      </Link>
      <Link
        href="/auth?mode=signup"
        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-material transition-transform hover:-translate-y-0.5"
      >
        Get started
      </Link>
    </nav>
  );
}
