"use client";

import { useCallback, useState } from "react";
import { type Row } from "@/lib/chats";

type PanelState = { row: Row; num: number; open: boolean } | null;

/**
 * Selection + open state for the slide-over detail panel, collapsed into one
 * object. Selection persists while the panel is closed so the bookmark tab can
 * reopen it; clicking the already-open row toggles it shut.
 */
export function useDetailPanel() {
  const [state, setState] = useState<PanelState>(null);

  const handleRowClick = useCallback((row: Row, num: number) => {
    setState((prev) =>
      prev && prev.open && prev.row.id === row.id
        ? { ...prev, open: false }
        : { row, num, open: true }
    );
  }, []);

  // Always open the given row (no toggle) — used for deep-link focus so a repeat
  // navigation to the same row reliably opens the panel.
  const openRow = useCallback(
    (row: Row, num: number) => setState({ row, num, open: true }),
    []
  );

  const close = useCallback(
    () => setState((prev) => (prev ? { ...prev, open: false } : null)),
    []
  );
  const reopen = useCallback(
    () => setState((prev) => (prev ? { ...prev, open: true } : null)),
    []
  );

  return {
    selected: state,
    open: state?.open ?? false,
    handleRowClick,
    openRow,
    close,
    reopen,
  };
}
