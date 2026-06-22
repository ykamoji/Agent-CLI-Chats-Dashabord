"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import ChatTable from "@/components/ChatTable";
import TurnDetailPanel from "@/components/TurnDetailPanel";
import LabelSelect from "@/components/LabelSelect";
import {
  ApiError,
  getChats,
  getDemoChats,
  isAuthenticated,
  sessionLabel,
  sessionName,
  updateSessionLabel,
  updateSessionName,
  deleteChats,
  type Chat,
  type SessionLabel,
  type SessionMap,
} from "@/lib/api";
import { str, type Row } from "@/lib/chats";

function SessionContent() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();

  const rawId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;
  const sessionId = decodeURIComponent(rawId ?? "");

  const demoUser = searchParams.get("demo");
  const isDemo = Boolean(demoUser);
  const backHref = isDemo
    ? `/dashboard?demo=${encodeURIComponent(demoUser as string)}`
    : "/dashboard";

  const [chats, setChats] = useState<Chat[]>([]);
  const [sessionMap, setSessionMap] = useState<SessionMap>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session-name editing state.
  const currentName = sessionName(sessionMap, sessionId);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
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
      setSessionMap(map);
    } catch {
      /* keep the previous name on failure */
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, currentName, sessionId, isDemo]);

  // Session-label state.
  const currentLabel = sessionLabel(sessionMap, sessionId);
  const [savingLabel, setSavingLabel] = useState(false);

  const saveLabel = useCallback(
    async (next: SessionLabel) => {
      if (next === currentLabel) return; // no change
      setSavingLabel(true);
      try {
        const map = await updateSessionLabel(sessionId, next, isDemo);
        setSessionMap(map);
      } catch {
        /* keep the previous label on failure */
      } finally {
        setSavingLabel(false);
      }
    },
    [currentLabel, sessionId, isDemo]
  );

  // Detail panel state.
  const [selected, setSelected] = useState<{ row: Row; num: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleRowClick = useCallback(
    (row: Row, num: number) => {
      // Clicking the already-open row toggles the panel closed.
      if (panelOpen && selected?.row.id === row.id) {
        setPanelOpen(false);
        return;
      }
      setSelected({ row, num });
      setPanelOpen(true);
    },
    [panelOpen, selected]
  );

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!isDemo && !isAuthenticated()) {
        router.replace("/auth");
        return;
      }
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const force = mode === "refresh";
        const data = isDemo
          ? await getDemoChats(force, sessionId)
          : await getChats({ forceRefresh: force, sessionId });
        setChats(data.chats);
        setSessionMap(data.sessionMap);
      } catch (err) {
        if (!isDemo && err instanceof ApiError && err.status === 401) {
          router.replace("/auth");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load chats.");
      } finally {
        if (mode === "initial") setLoading(false);
        else setRefreshing(false);
      }
    },
    [isDemo, router]
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-paper">
              &gt;_
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              CLI Dashboard
            </span>
          </Link>
          {isDemo ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper-soft px-4 py-1.5 text-xs font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Viewing: {demoUser}
            </span>
          ) : (
            <UserMenu />
          )}
        </div>
      </header>

      <div
        className={`px-6 py-10 transition-[margin] duration-300 ease-out ${panelOpen ? "lg:mr-[50vw]" : ""
          }`}
      >
        {/* Back */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
        >
          ← Back to sessions
        </Link>

        {/* Unified session id + editable name */}
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-material">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Session
            </p>
            {savingName && (
              <span className="text-[10px] text-ink-muted">Saving…</span>
            )}
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
                    <h1 className="font-display text-2xl tracking-tight">
                      {currentName}
                    </h1>
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
            <LabelSelect
              value={currentLabel}
              onChange={saveLabel}
              saving={savingLabel}
            />
          </div>

          {!loading && !error && (
            <p className="mt-2 text-xs text-ink-muted">
              {chats.length} turn{chats.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Turns table (session column removed) */}
        <div className="mt-6">
          <ChatTable
            chats={chats}
            loading={loading}
            error={error}
            hideSession
            title="Turns"
            onRefresh={() => load("refresh")}
            refreshing={refreshing}
            selectedId={panelOpen ? selected?.row.id ?? null : null}
            onRowClick={handleRowClick}
            onDelete={async (selectedRawChats) => {
              setChats(prev => prev.filter(c => !selectedRawChats.includes(c)));
              const records = selectedRawChats.map((raw) => ({
                entry_index: raw.entry_index,
                session_id: raw.session_id,
                cli_agent: raw.cli_agent,
                user_id: raw.user_id,
              }));
              await deleteChats(records, isDemo);
              load("refresh");
            }}
          />
        </div>
      </div>

      {/* Slide-over detail panel */}
      <TurnDetailPanel
        row={selected?.row ?? null}
        rowNumber={selected?.num}
        agent={selected?.row.agent}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onReopen={() => setPanelOpen(true)}
      />
    </main>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-paper text-ink">
          <p className="text-ink-muted">Loading…</p>
        </main>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
