"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ToolCard from "@/components/session/detail/ToolCard";
import { type Bookmark, type Row, type ToolUse } from "@/lib/chats";
import { getStoredUser, getTurnTools, updateChatBookmark, type Chat } from "@/lib/api";

// Presentational detail for a single Conversation: Input + the individual tool calls,
// styled exactly like the previous inline "expanded row" view. Reused by the
// slide-over detail panel.
export default function TurnDetail({
  row,
  onBookmarkSaved,
}: {
  row: Row;
  onBookmarkSaved?: (raw: Chat, bookmark: Bookmark) => void;
}) {
  const searchParams = useSearchParams();
  const isDemo = Boolean(searchParams.get("demo"));
  // Bookmarks are editable for the owner; on demo sessions, only admins may edit.
  const isAdmin = getStoredUser()?.role === "admin";
  const canEdit = !isDemo || isAdmin;

  const [tools, setTools] = useState<ToolUse[]>([]);
  const [loading, setLoading] = useState(false);

  // Bookmark editing state (seeded from the row, reset when the row changes).
  const [bookmark, setBookmark] = useState<Bookmark>(row.bookmark);
  const [editingBookmark, setEditingBookmark] = useState(false);
  const [enabledDraft, setEnabledDraft] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [savingBookmark, setSavingBookmark] = useState(false);

  useEffect(() => {
    if (row.toolCount > 0) {
      setLoading(true);
      getTurnTools(row.sessionId, row.entryIndex, isDemo)
        .then((data) => setTools(data as ToolUse[]))
        .catch(() => setTools([]))
        .finally(() => setLoading(false));
    } else {
      setTools([]);
    }
  }, [row, isDemo]);

  useEffect(() => {
    setBookmark(row.bookmark);
    setEditingBookmark(false);
  }, [row]);

  const startEditBookmark = () => {
    setEnabledDraft(Boolean(bookmark.enabled));
    setMessageDraft(bookmark.message);
    setEditingBookmark(true);
  };

  const saveBookmark = async () => {
    const next: Bookmark = {
      enabled: enabledDraft ? 1 : 0,
      message: messageDraft.trim(),
    };
    setSavingBookmark(true);
    try {
      await updateChatBookmark(row.raw, enabledDraft, next.message, isDemo);
      setBookmark(next);
      onBookmarkSaved?.(row.raw, next);
      setEditingBookmark(false);
    } catch {
      /* keep the previous bookmark on failure */
    } finally {
      setSavingBookmark(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Bookmark */}
      <div className="rounded-lg border border-ink/10 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Bookmark
            {savingBookmark && <span className="normal-case">Saving…</span>}
          </div>
          {canEdit && !editingBookmark && (
            <button
              type="button"
              onClick={startEditBookmark}
              aria-label="Edit bookmark"
              className="grid h-7 w-7 place-items-center rounded-full border border-ink/10 bg-white text-ink-muted shadow-material transition-colors hover:bg-paper-soft hover:text-ink"
            >
              <svg
                className="h-3.5 w-3.5"
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
          )}
        </div>

        {editingBookmark ? (
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabledDraft}
                onChange={(e) => setEnabledDraft(e.target.checked)}
                className="rounded border-ink/30 text-ink focus:ring-ink"
              />
              <span>Bookmarked</span>
            </label>
            <input
              type="text"
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              placeholder="Add a note (optional)…"
              maxLength={200}
              className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-sm outline-none transition-colors focus:border-ink focus:bg-white"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveBookmark}
                disabled={savingBookmark}
                className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper shadow-material transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingBookmark(false)}
                disabled={savingBookmark}
                className="rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : bookmark.enabled ? (
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm text-ink">
              {bookmark.message || "Bookmarked"}
            </span>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">Not bookmarked.</p>
        )}
      </div>

      {/* Input */}
      <div className="rounded-lg border border-ink/10 bg-white p-3">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Input
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-paper-soft p-2 font-mono text-xs text-ink">
          {row.input || "—"}
        </pre>
      </div>

      {/* Output (may be absent on errors) */}
      {row.output && (
        <div className="rounded-lg border border-ink/10 bg-white p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Output
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-paper-soft p-2 font-mono text-xs text-ink">
            {row.output}
          </pre>
        </div>
      )}

      {/* Tools */}
      <div className="rounded-lg border border-ink/10 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Tools Used
          {row.toolCount > 0 && (
            <span className="font-mono normal-case">({row.toolCount})</span>
          )}
        </div>
        {row.toolCount === 0 ? (
          <p className="text-xs text-ink-muted">No tools used in this Conversation.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Loading tools...
          </div>
        ) : (
          <div className="space-y-2">
            {tools.map((t, ti) => (
              <ToolCard key={ti} tool={t} index={ti} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
