"use client";

import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/api";

/**
 * Client-only auth check. Returns false during SSR / the first client render
 * (so markup matches and there's no hydration mismatch), then the real value
 * after mount. The token lives in sessionStorage, so it can only be read here.
 */
export function useIsAuthenticated(): boolean {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);
  return authed;
}
