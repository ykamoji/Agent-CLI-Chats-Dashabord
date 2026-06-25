"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  sessionName,
  updateSessionGroup,
  type SessionGroup,
  type SessionMap,
} from "@/lib/api";
import { fmtTime } from "@/lib/chats";
import GroupSelect from "@/components/GroupSelect";

type Tab = "groups" | "assign";

export default function SessionGroupModal({
  open,
  onClose,
  sessions,
  sessionMap,
  groups,
  onUpdate,
  isDemo,
}: {
  open: boolean;
  onClose: () => void;
  sessions: SessionGroup[];
  sessionMap: SessionMap;
  groups: { name: string; session_list: string[] }[];
  onUpdate: () => void;
  isDemo: boolean;
}) {
  const [tab, setTab] = useState<Tab>("groups");
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedExistingGroup, setSelectedExistingGroup] = useState("");
  const [saving, setSaving] = useState(false);

  // Rename state
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef(false);

  // Delete confirmation state
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);

  // Reset state when modal reopens
  useEffect(() => {
    if (open) {
      setTab("groups");
      setSelectedForGroup(new Set());
      setNewGroupName("");
      setSelectedExistingGroup("");
      setRenamingGroup(null);
      setConfirmDeleteGroup(null);
    }
  }, [open]);

  const groupedSessionIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      for (const sid of g.session_list) set.add(sid);
    }
    return set;
  }, [groups]);

  const ungroupedSessions = useMemo(() => {
    return sessions.filter((s) => !groupedSessionIds.has(s.sessionId));
  }, [sessions, groupedSessionIds]);

  if (!open) return null;

  // --- Handlers ---

  async function handleCreateGroup() {
    if (!newGroupName.trim() || selectedForGroup.size === 0) return;
    setSaving(true);
    try {
      await updateSessionGroup(Array.from(selectedForGroup), newGroupName.trim(), isDemo);
      setSelectedForGroup(new Set());
      setNewGroupName("");
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToExistingGroup() {
    if (!selectedExistingGroup || selectedForGroup.size === 0) return;
    setSaving(true);
    try {
      await updateSessionGroup(Array.from(selectedForGroup), selectedExistingGroup, isDemo);
      setSelectedForGroup(new Set());
      setSelectedExistingGroup("");
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSession(sessionId: string) {
    setSaving(true);
    try {
      await updateSessionGroup([sessionId], "", isDemo);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(sessionIds: string[]) {
    setSaving(true);
    try {
      await updateSessionGroup(sessionIds, "", isDemo);
      setConfirmDeleteGroup(null);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameGroup(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingGroup(null);
      return;
    }
    setSaving(true);
    try {
      const group = groups.find((g) => g.name === oldName);
      if (group) {
        await updateSessionGroup(group.session_list, trimmed, isDemo);
        onUpdate();
      }
    } finally {
      setSaving(false);
      setRenamingGroup(null);
    }
  }

  function handleSelectAll() {
    setSelectedForGroup(new Set(ungroupedSessions.map((s) => s.sessionId)));
  }

  function handleClearSelection() {
    setSelectedForGroup(new Set());
  }

  // --- Render ---

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-material-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
          <h2 className="font-display text-xl font-bold">Manage Sessions</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10">
          <button
            type="button"
            onClick={() => setTab("groups")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${tab === "groups"
              ? "border-b-2 border-ink text-ink"
              : "text-ink-muted hover:text-ink"
              }`}
          >
            Groups{groups.length > 0 && ` (${groups.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab("assign")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${tab === "assign"
              ? "border-b-2 border-ink text-ink"
              : "text-ink-muted hover:text-ink"
              }`}
          >
            Assign Sessions
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "groups" ? (
            /* ── Groups Tab ── */
            groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-ink/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm font-medium text-ink-muted">No groups created yet</p>
                <p className="mt-1 text-xs text-ink-muted/70">
                  Switch to the "Assign Sessions" tab to create your first group.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <details
                    key={g.name}
                    className="group/acc overflow-hidden rounded-xl border border-ink/10 bg-paper-soft transition-shadow hover:shadow-material"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-ink/5">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <svg className="h-4 w-4 flex-shrink-0 text-ink-muted transition-transform group-open/acc:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                        {renamingGroup === g.name ? (
                          <input
                            autoFocus
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => {
                              if (renameRef.current) {
                                renameRef.current = false;
                                setRenamingGroup(null);
                                return;
                              }
                              handleRenameGroup(g.name, renameDraft);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              } else if (e.key === "Escape") {
                                renameRef.current = true;
                                setRenamingGroup(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            maxLength={80}
                            className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm outline-none transition-colors focus:border-ink"
                          />
                        ) : (
                          <span className="truncate font-medium">{g.name}</span>
                        )}
                        <span className="flex-shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-xs text-ink-muted">
                          {g.session_list.length}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {/* Rename button */}
                        <button
                          disabled={saving}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenameDraft(g.name);
                            setRenamingGroup(g.name);
                          }}
                          title="Rename group"
                          className="grid h-7 w-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        {/* Delete button */}
                        {confirmDeleteGroup === g.name ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
                            <button
                              disabled={saving}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteGroup(g.session_list);
                              }}
                              className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                            >
                              {saving ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmDeleteGroup(null);
                              }}
                              className="rounded-full border border-ink/15 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-paper-soft"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={saving}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmDeleteGroup(g.name);
                            }}
                            title="Delete group"
                            className="grid h-7 w-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </summary>
                    <div className="border-t border-ink/10 bg-white">
                      <ul className="divide-y divide-ink/5">
                        {g.session_list.map((sid) => {
                          const sname = sessionName(sessionMap, sid);
                          return (
                            <li key={sid} className="flex items-center justify-between px-6 py-3 text-sm transition-colors hover:bg-paper-soft">
                              <span className="truncate font-mono text-ink-muted" title={sid}>
                                {sname || `${sid.slice(0, 8)}…`}
                              </span>
                              <button
                                disabled={saving}
                                onClick={() => handleRemoveSession(sid)}
                                className="flex-shrink-0 text-xs font-medium text-ink-muted transition-colors hover:text-red-600 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </details>
                ))}
              </div>
            )
          ) : (
            /* ── Assign Sessions Tab ── */
            ungroupedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-ink/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                <p className="text-sm font-medium text-ink-muted">All sessions are already grouped</p>
                <p className="mt-1 text-xs text-ink-muted/70">
                  Every session belongs to a group. Remove sessions from existing groups to reassign them.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Selection toolbar */}
                <div className="flex items-center justify-between rounded-lg bg-paper-soft px-4 py-2.5">
                  <span className="text-xs font-medium text-ink-muted">
                    {selectedForGroup.size > 0 ? (
                      <>
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-white">
                          {selectedForGroup.size}
                        </span>
                        <span className="ml-1.5">selected</span>
                      </>
                    ) : (
                      `${ungroupedSessions.length} ungrouped session${ungroupedSessions.length !== 1 ? "s" : ""}`
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={selectedForGroup.size === ungroupedSessions.length}
                      className="text-xs font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
                    >
                      Select All
                    </button>
                    {selectedForGroup.size > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Session checklist */}
                <div className="max-h-[40vh] min-h-0 overflow-y-auto rounded-xl border border-ink/10 bg-white p-2">
                  <ul className="space-y-0.5">
                    {ungroupedSessions.map((s) => {
                      const sname = sessionName(sessionMap, s.sessionId);
                      const isChecked = selectedForGroup.has(s.sessionId);
                      return (
                        <li key={s.sessionId}>
                          <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isChecked ? "bg-ink/5" : "hover:bg-paper-soft"}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = new Set(selectedForGroup);
                                if (e.target.checked) next.add(s.sessionId);
                                else next.delete(s.sessionId);
                                setSelectedForGroup(next);
                              }}
                              className="h-4 w-4 rounded border-ink/30 text-ink focus:ring-ink"
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-medium">{sname || s.sessionId}</span>
                              <span className="text-xs text-ink-muted">
                                {s.count} Conversation{s.count !== 1 ? "s" : ""} · Last active {fmtTime(s.latestTs)}
                              </span>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Action panels */}
                <div className="space-y-3">
                  {/* Create New Group */}
                  <div className="rounded-xl border border-ink/10 bg-paper-soft p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Create New Group
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Enter group name…"
                        className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ink"
                      />
                      <button
                        disabled={saving || !newGroupName.trim() || selectedForGroup.size === 0}
                        onClick={handleCreateGroup}
                        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/80 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                      >
                        {saving ? "Saving…" : "Create"}
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  {groups.length > 0 && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-ink/10" />
                        <span className="text-xs font-medium text-ink-muted/60">or</span>
                        <div className="h-px flex-1 bg-ink/10" />
                      </div>

                      {/* Add to Existing Group */}
                      <div className="rounded-xl border border-ink/10 bg-paper-soft p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          Add to Existing Group
                        </p>
                        <div className="flex items-center gap-3">
                          <GroupSelect
                            value={selectedExistingGroup}
                            onChange={setSelectedExistingGroup}
                            groups={groups}
                          />
                          <button
                            disabled={saving || !selectedExistingGroup || selectedForGroup.size === 0}
                            onClick={handleAddToExistingGroup}
                            className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                          >
                            {saving ? "Saving…" : "Add"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
