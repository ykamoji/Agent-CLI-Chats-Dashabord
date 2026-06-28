"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchIndex } from "@/lib/useSearchIndex";
import { type SearchEntry, type SearchField } from "@/lib/api";
import { fmtTime } from "@/lib/chats";

const FIELD_OPTIONS: { value: SearchField; label: string }[] = [
  { value: "input", label: "Input" },
  { value: "output", label: "Output" },
  { value: "tool", label: "Tool name" },
  { value: "all", label: "All fields" },
];

const MAX_RESULTS = 10;
const MIN_CHARS = 2;
const SNIPPET_PAD = 105;

type Match = {
  entry: SearchEntry;
  field: Exclude<SearchField, "all">;
  snippet: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a short snippet window centred on the first match of `q` in `text`.
function snippetOf(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text.slice(0, SNIPPET_PAD * 2);
  const start = Math.max(0, idx - SNIPPET_PAD);
  const end = Math.min(text.length, idx + q.length + SNIPPET_PAD);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

// Split `text` on `q` (case-insensitive) and wrap matches in <mark>.
function Highlighted({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * Reusable, centred search box. Loads the user's search index once (cached in
 * sessionStorage via useSearchIndex) and filters it client-side for instant
 * results. Clicking a result deep-links to the session row (?focus=entry_index).
 */
export default function Search({
  isDemo,
  demoUser,
  reloadToken,
}: {
  isDemo: boolean;
  demoUser?: string | null;
  reloadToken?: number;
}) {
  const router = useRouter();
  const { entries, loading, reload } = useSearchIndex(isDemo);

  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("input");
  const [open, setOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Refresh the index when the page's Sync bumps the token (skip first run).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reload();
  }, [reloadToken, reload]);

  // Close popovers on outside click / Escape.
  useEffect(() => {
    if (!open && !fieldOpen) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFieldOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setFieldOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, fieldOpen]);

  const q = query.trim().toLowerCase();

  const matches = useMemo<Match[]>(() => {
    if (q.length < MIN_CHARS) return [];
    const out: Match[] = [];
    for (const entry of entries) {
      let m: Match | null = null;
      if ((field === "input" || field === "all") && entry.input.toLowerCase().includes(q)) {
        m = { entry, field: "input", snippet: snippetOf(entry.input, q) };
      } else if ((field === "output" || field === "all") && entry.output.toLowerCase().includes(q)) {
        m = { entry, field: "output", snippet: snippetOf(entry.output, q) };
      } else if (field === "tool" || field === "all") {
        const tool = entry.tools.find((t) => t.toLowerCase().includes(q));
        if (tool) m = { entry, field: "tool", snippet: tool };
      }
      if (m) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [entries, q, field]);

  function goTo(entry: SearchEntry) {
    const params = new URLSearchParams();
    params.set("focus", String(entry.entry_index));
    if (isDemo && demoUser) params.set("demo", demoUser);
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/session/${encodeURIComponent(entry.session_id)}?${params.toString()}`);
  }

  const fieldLabel = FIELD_OPTIONS.find((o) => o.value === field)?.label ?? "Input";

  return (
    <div ref={ref} className="relative mx-auto w-full">
      <div className="flex items-center gap-2 rounded-full border border-ink/15 bg-white px-2 py-1.5 shadow-material focus-within:border-ink">
        {/* Field selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setFieldOpen((v) => !v);
              setOpen(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-paper-soft"
          >
            {fieldLabel}
            <svg
              className={`h-3.5 w-3.5 transition-transform ${fieldOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {fieldOpen && (
            <div
              role="listbox"
              className="absolute left-0 z-30 mt-2 w-40 overflow-hidden rounded-xl border border-ink/10 bg-white p-1 shadow-material-lg"
            >
              {FIELD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === field}
                  onClick={() => {
                    setField(o.value);
                    setFieldOpen(false);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${o.value === field ? "bg-paper-soft font-medium" : "hover:bg-paper-soft"
                    }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="h-5 w-px bg-ink/10" />

        <svg
          className="h-4 w-4 flex-shrink-0 text-ink-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setFieldOpen(false);
          }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? "Loading search index…" : "Search your conversations…"}
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-ink-muted"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear search"
            className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && q.length >= MIN_CHARS && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-[22rem] overflow-y-auto rounded-2xl border border-ink/10 bg-white p-1 shadow-material-lg">
          {matches.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">
              {loading ? "Loading…" : "No matches found."}
            </p>
          ) : (
            matches.map((m, i) => (
              <button
                key={`${m.entry.session_id}-${m.entry.entry_index}-${i}`}
                type="button"
                onClick={() => goTo(m.entry)}
                className="flex w-full flex-col gap-1 rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-paper-soft"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    #{m.entry.entry_index} {m.entry.session_name || m.entry.session_id || "—"}
                  </span>
                  <div className="ml-auto flex-shrink-0 flex flex-col gap-1">
                    <span className="rounded-full bg-paper-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                      {m.field}
                    </span>
                    <span className="truncate text-[10px] ml-2 text-ink-muted">
                      {fmtTime(m.entry.timestamp)}
                    </span>
                    <span className="truncate text-[10px] ml-2 text-ink-muted">
                      {m.entry.cli_agent}
                    </span>
                  </div>
                </div>
                <p className="line-clamp-2 break-words font-mono text-xs text-ink-muted">
                  <Highlighted text={m.snippet} q={q} />
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
