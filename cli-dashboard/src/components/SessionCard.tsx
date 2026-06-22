import Link from "next/link";
import { type SessionLabel } from "@/lib/api";
import { fmtTime } from "@/lib/chats";

// A virtual "session" grouping card — shows only the session id and the
// latest timestamp. Clicking it opens that session's full turn table.
export default function SessionCard({
  sessionId,
  latestTimestamp,
  href,
  name,
  label = "None",
}: {
  sessionId: string;
  latestTimestamp: string;
  href: string;
  name?: string;
  label?: SessionLabel;
}) {
  const tagged = Boolean(name);
  const accent =
    label === "Green"
      ? "border-l-4 border-l-green-500"
      : label === "Blue"
      ? "border-l-4 border-l-blue-500"
      : "";
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border border-ink/10 bg-white p-5 shadow-material transition-all hover:-translate-y-0.5 hover:shadow-material-lg ${accent}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Session
        </span>
        <div className="flex items-center gap-2">
          {label !== "None" && (
            <span
              title={label}
              className={`h-2.5 w-2.5 rounded-full ${
                label === "Green" ? "bg-green-500" : "bg-blue-500"
              }`}
            />
          )}
          <span
            aria-hidden
            className="text-ink-muted transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </div>
      </div>
      {tagged ? (
        <>
          <p
            className="mt-2 font-display text-lg font-bold leading-snug tracking-tight"
            title={name}
          >
            {name}
          </p>
          <p
            className="mt-1 break-all font-mono text-xs text-ink-muted"
            title={sessionId}
          >
            {sessionId || "—"}
          </p>
        </>
      ) : (
        <p className="mt-2 break-all font-mono text-sm leading-snug" title={sessionId}>
          {sessionId || "—"}
        </p>
      )}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-muted">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span title={latestTimestamp}>{fmtTime(latestTimestamp)}</span>
      </div>
    </Link>
  );
}
