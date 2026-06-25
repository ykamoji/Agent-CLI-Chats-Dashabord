"use client";

import { useState } from "react";
import { sessionName, updateSessionGroup, type SessionGroup, type SessionMap } from "@/lib/api";
import { fmtTime } from "@/lib/chats";

export default function AddSessionsToGroupModal({
  open,
  onClose,
  ungroupedSessions,
  sessionMap,
  groupName,
  isDemo,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  ungroupedSessions: SessionGroup[];
  sessionMap: SessionMap;
  groupName: string;
  isDemo: boolean;
  onUpdate: () => void;
}) {
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleAdd() {
    if (selectedForGroup.size === 0) return;
    setSaving(true);
    try {
      await updateSessionGroup(Array.from(selectedForGroup), groupName, isDemo);
      setSelectedForGroup(new Set());
      onUpdate();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-material-lg">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
          <h2 className="font-display text-xl font-bold">Add Sessions to {groupName}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {ungroupedSessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No ungrouped sessions available to add.</p>
          ) : (
            <div className="rounded-xl border border-ink/10 bg-white">
              <div className="max-h-96 overflow-y-auto p-2">
                <ul className="space-y-1">
                  {ungroupedSessions.map((s) => {
                    const sname = sessionName(sessionMap, s.sessionId);
                    const isChecked = selectedForGroup.has(s.sessionId);
                    return (
                      <li key={s.sessionId}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-paper-soft">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedForGroup);
                              if (e.target.checked) next.add(s.sessionId);
                              else next.delete(s.sessionId);
                              setSelectedForGroup(next);
                            }}
                            className="rounded border-ink/30 text-ink focus:ring-ink"
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{sname || s.sessionId}</span>
                            <span className="text-xs text-ink-muted">
                              {s.count} Conversations • Last active {fmtTime(s.latestTs)}
                            </span>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-ink/10 bg-paper-soft p-4">
                <button
                  onClick={onClose}
                  className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-soft"
                >
                  Cancel
                </button>
                <button
                  disabled={saving || selectedForGroup.size === 0}
                  onClick={handleAdd}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Adding…" : `Add ${selectedForGroup.size} Session${selectedForGroup.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
