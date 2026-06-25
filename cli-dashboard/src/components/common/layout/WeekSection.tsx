"use client";

import { useState, type ReactNode } from "react";

// A labeled divider that collapses/expands its content with a slide. The week
// label sits on top of a thin horizontal line; clicking it toggles the cards.
export default function WeekSection({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Divider with the week label overlapping the line */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group relative flex w-full items-center py-2"
      >
        <span className="h-px w-full bg-ink/10" />
        <span className="absolute left-0 inline-flex items-center gap-2 bg-paper pr-3 text-xs font-medium uppercase tracking-wide text-ink-muted transition-colors group-hover:text-ink">
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.21 5.23a.75.75 0 011.06.02L12.5 9.5a.75.75 0 010 1.06l-4.23 4.25a.75.75 0 11-1.08-1.04L10.92 10 7.19 6.29a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
          {label}
          <span className="text-ink-muted/60">({count})</span>
        </span>
      </button>

      {/* Sliding content */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-4 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
