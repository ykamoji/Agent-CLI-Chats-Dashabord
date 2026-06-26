"use client";

import { useEffect, useRef, useState } from "react";

const OPTIONS: { value: string; label: string }[] = [
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
  { value: "gemini-3-flash", label: "Gemini 3 Flash" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { value: "gemma-3-27b-it", label: "Gemma 3" },
  { value: "gemma-4-31b-it", label: "Gemma 4" },
];

export default function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
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

  // If the currently selected model isn't in our predefined list, add it dynamically
  const currentOptions = OPTIONS.some((o) => o.value === value)
    ? OPTIONS
    : [...OPTIONS, { value, label: value }];

  const current = currentOptions.find((o) => o.value === value) ?? currentOptions[0];

  function select(next: string) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <div ref={ref} className="relative inline-block w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-paper"
      >
        <span className="truncate">{current.label}</span>
        <svg
          className={`h-3 w-3 shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""
            }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-1 w-full min-w-40 origin-top-right animate-in fade-in zoom-in-95 rounded-xl border border-ink/10 bg-white p-1.5 shadow-material">
          {currentOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-paper active:bg-ink/5"
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.value && (
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-ink"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
