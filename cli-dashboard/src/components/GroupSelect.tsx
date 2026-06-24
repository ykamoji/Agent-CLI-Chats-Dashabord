"use client";

import { useEffect, useRef, useState } from "react";

// A themed dropdown for picking an existing group. Selecting an option
// closes the popover and reports the change.
export default function GroupSelect({
  value,
  onChange,
  groups,
  saving = false,
}: {
  value: string;
  onChange: (group: string) => void;
  groups: { name: string }[];
  saving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = groups.find((g) => g.name === value);
  const displayLabel = current ? current.name : "Select existing group…";

  function select(next: string) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <div ref={ref} className="relative inline-block flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft focus:border-ink outline-none"
      >
        <span className="truncate font-normal">{displayLabel}</span>
        {saving ? (
          <svg
            className="h-3.5 w-3.5 animate-spin text-ink-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        ) : (
          <svg
            className={`h-4 w-4 flex-shrink-0 text-ink-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-full max-h-48 origin-bottom overflow-y-auto rounded-xl border border-ink/10 bg-white p-1 shadow-material-lg"
        >
          {groups.map((g) => {
            const active = g.name === value;
            return (
              <button
                key={g.name}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(g.name)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active ? "bg-paper-soft font-medium" : "hover:bg-paper-soft"
                }`}
              >
                <span className="truncate">{g.name}</span>
                {active && (
                  <svg className="h-4 w-4 flex-shrink-0 text-ink" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
