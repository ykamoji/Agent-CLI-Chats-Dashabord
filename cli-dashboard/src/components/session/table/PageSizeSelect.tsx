"use client";

import { useEffect, useRef, useState } from "react";

const OPTIONS = [25, 50, 100];

// A themed dropdown for picking the table page size, styled to match the
// header's pill buttons. Selecting an option closes the popover and reports
// the change. Mirrors the pattern in session/header/LabelSelect.
export default function PageSizeSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (size: number) => void;
  disabled?: boolean;
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

  function select(next: number) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-material transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          className="h-3.5 w-3.5 text-ink-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </svg>
        <span>{value}</span>
        <svg
          className={`h-4 w-4 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
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

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1.5 w-36 origin-top overflow-hidden rounded-xl border border-ink/10 bg-white p-1 shadow-material-lg"
        >
          {OPTIONS.map((o) => {
            const active = o === value;
            return (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(o)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? "bg-paper-soft font-medium" : "hover:bg-paper-soft"
                  }`}
              >
                <span className="flex-1">{o}</span>
                {active && (
                  <svg className="h-4 w-4 text-ink" viewBox="0 0 20 20" fill="currentColor">
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
