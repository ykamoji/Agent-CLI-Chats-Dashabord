"use client";

import { useCallback, useRef, useState } from "react";
import LabelSelect from "@/components/LabelSelect";
import {
  sessionLabel,
  sessionName,
  updateSessionLabel,
  updateSessionName,
  type SessionLabel,
  type SessionMap,
} from "@/lib/api";

// The session header card: unified session id, an editable name (pencil →
// input, commit on blur/Enter, cancel on Escape) and a color label. Owns all of
// its own editing/saving state; reports session_map changes upward.
export default function SessionHeader({
  sessionId,
  isDemo,
  sessionMap,
  onSessionMapChange,
  turnsCount,
  showTurns,
}: {
  sessionId: string;
  isDemo: boolean;
  sessionMap: SessionMap;
  onSessionMapChange: (map: SessionMap) => void;
  turnsCount: number;
  showTurns: boolean;
}) {
  const currentName = sessionName(sessionMap, sessionId);
  const currentLabel = sessionLabel(sessionMap, sessionId);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const cancelRef = useRef(false);

  const startEditing = useCallback(() => {
    setNameDraft(currentName);
    setEditing(true);
  }, [currentName]);

  const commitName = useCallback(async () => {
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false; // Escape pressed — discard the edit
      return;
    }
    const next = nameDraft.trim();
    if (next === currentName) return; // no change
    setSavingName(true);
    try {
      const map = await updateSessionName(sessionId, next, isDemo);
      onSessionMapChange(map);
    } catch {
      /* keep the previous name on failure */
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, currentName, sessionId, isDemo, onSessionMapChange]);

  const saveLabel = useCallback(
    async (next: SessionLabel) => {
      if (next === currentLabel) return; // no change
      setSavingLabel(true);
      try {
        const map = await updateSessionLabel(sessionId, next, isDemo);
        onSessionMapChange(map);
      } catch {
        /* keep the previous label on failure */
      } finally {
        setSavingLabel(false);
      }
    },
    [currentLabel, sessionId, isDemo, onSessionMapChange]
  );

  return (
    <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-material">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Session
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
          placeholder="Name this session…"
          maxLength={80}
          className="mt-1 w-full max-w-xl rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 font-display text-xl outline-none transition-colors focus:border-ink focus:bg-white"
        />
      ) : (
        <div className="mt-1 flex items-start gap-2">
          <div className="min-w-0">
            {currentName ? (
              <>
                <h1 className="font-display text-2xl tracking-tight">{currentName}</h1>
                <p className="mt-1 break-all font-mono text-xs text-ink-muted">
                  {sessionId || "—"}
                </p>
              </>
            ) : (
              <h1 className="break-all font-mono text-xl">{sessionId || "—"}</h1>
            )}
          </div>
          <button
            type="button"
            onClick={startEditing}
            aria-label={currentName ? "Rename session" : "Name this session"}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink-muted shadow-material transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Color label */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Label
        </span>
        <LabelSelect value={currentLabel} onChange={saveLabel} saving={savingLabel} />
      </div>

      {showTurns && (
        <p className="mt-2 text-xs text-ink-muted">
          {turnsCount} turn{turnsCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
