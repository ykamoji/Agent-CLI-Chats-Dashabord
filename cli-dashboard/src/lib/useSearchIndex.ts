"use client";

import { useCallback, useEffect, useState } from "react";
import { getSearchIndex, type SearchEntry } from "@/lib/api";

/**
 * Lazy-loads the user's full searchable index (once, on mount) and keeps it in
 * memory for instant client-side filtering. `reload()` force-refreshes it,
 * bypassing both the client and server caches — wired to each page's Sync.
 */
export function useSearchIndex(isDemo: boolean) {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (forceRefresh: boolean) => {
      setLoading(true);
      try {
        const data = await getSearchIndex({ demo: isDemo, forceRefresh });
        setEntries(data);
        setError(null);
      } catch {
        setError("Failed to load search index.");
      } finally {
        setLoading(false);
      }
    },
    [isDemo]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  return { entries, loading, error, reload };
}
