"use client";

import { useCallback, useRef, useState } from "react";

export default function GroupSessionHeader({
  groupName,
  sessionsCount,
  onRenameGroup,
  selectionEnabled,
  onEnableSelection,
  onCancelSelection,
  onRemoveSelected,
  selectedCount,
  onAddSessionsClick,
  isAdmin,
}: {
  groupName: string;
  sessionsCount: number;
  onRenameGroup: (newName: string) => Promise<void>;
  selectionEnabled: boolean;
  onEnableSelection: () => void;
  onCancelSelection: () => void;
  onRemoveSelected: () => Promise<void>;
  selectedCount: number;
  onAddSessionsClick: () => void;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [removing, setRemoving] = useState(false);
  const cancelRef = useRef(false);

  const startEditing = useCallback(() => {
    setNameDraft(groupName);
    setEditing(true);
  }, [groupName]);

  const commitName = useCallback(async () => {
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false; // Escape pressed — discard the edit
      return;
    }
    const next = nameDraft.trim();
    if (next === groupName || !next) return; // no change or empty
    setSavingName(true);
    try {
      await onRenameGroup(next);
    } catch {
      /* keep the previous name on failure */
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, groupName, onRenameGroup]);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemoveSelected();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-material">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Session Group
        </p>
        {savingName && <span className="text-[10px] text-ink-muted">Saving…</span>}
      </div>

      {editing ? (
        <input
          autoFocus
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              cancelRef.current = true;
              setEditing(false);
            }
          }}
          placeholder="Name this group…"
          maxLength={80}
          className="mt-4 w-full max-w-xl rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 font-display text-xl outline-none transition-colors focus:border-ink focus:bg-white"
        />
      ) : (
        <div className="mt-4 flex items-start gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-tight">{groupName}</h1>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={startEditing}
              aria-label="Rename group"
              className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink-muted shadow-material transition-colors hover:bg-paper-soft hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-4">
        <p className="text-xs font-medium text-ink-muted">
          {sessionsCount} session{sessionsCount !== 1 ? "s" : ""}
        </p>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {selectionEnabled ? (
              <>
                <span className="text-xs text-ink-muted mr-2">{selectedCount} selected</span>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={selectedCount === 0 || removing}
                  className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Remove Selected"}
                </button>
                <button
                  type="button"
                  onClick={onCancelSelection}
                  disabled={removing}
                  className="rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAddSessionsClick}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add Sessions
                </button>
                <button
                  type="button"
                  onClick={onEnableSelection}
                  disabled={sessionsCount === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Select
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
