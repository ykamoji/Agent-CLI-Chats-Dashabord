import Link from "next/link";
import { type SessionLabel } from "@/lib/api";
import { fmtTime } from "@/lib/chats";
import AgentBadge from "@/components/AgentBadge";

// A virtual "session" grouping card — shows only the session id and the
// latest timestamp. Clicking it opens that session's full Conversation table.
export default function SessionCard({
  sessionId,
  latestTimestamp,
  href,
  name,
  label = "None",
  agent,
  groupSessions,
  selectable,
  selected,
  onToggle,
  count,
}: {
  sessionId: string;
  latestTimestamp: string;
  href: string;
  name?: string;
  label?: SessionLabel;
  agent?: string;
  groupSessions?: { sessionId: string; name: string; agent?: string }[];
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (selected: boolean) => void;
  count?: number;
}) {
  const tagged = Boolean(name);
  const accent =
    label === "Green"
      ? "border-l-4 border-l-green-500"
      : label === "Blue"
        ? "border-l-4 border-l-blue-500"
        : "";

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              readOnly
              className="mr-1 h-4 w-4 rounded border-ink/30 text-ink focus:ring-ink"
            />
          )}
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            {groupSessions ? "Group" : "Session"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {label !== "None" && (
            <span
              title={label}
              className={`h-2.5 w-2.5 rounded-full ${label === "Green" ? "bg-green-500" : "bg-blue-500"
                }`}
            />
          )}
          {!selectable && (
            <span
              aria-hidden
              className="text-ink-muted transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          )}
        </div>
      </div>
      {groupSessions ? (
        <>
          <p
            className="mt-2 font-display text-lg font-bold leading-snug tracking-tight"
            title={name}
          >
            {name}
          </p>
          <ul className="mt-2 space-y-0.5">
            {groupSessions.map((s) => (
              <li key={s.sessionId} className="truncate font-mono text-xs text-ink-muted" title={s.sessionId}>
                {s.name || s.sessionId}
              </li>
            ))}
          </ul>
        </>
      ) : tagged ? (
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
      <div className="mt-auto pt-4 flex items-center justify-between">
        {groupSessions ? (
          <div className="text-xs font-medium text-ink-muted">
            {groupSessions.length} {groupSessions.length === 1 ? "session" : "sessions"}
            {count !== undefined && ` • ${count} Conversation${count !== 1 ? "s" : ""}`}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <div className="flex items-center gap-1.5">
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
            {count !== undefined && (
              <div className="flex items-center gap-1.5 border-l border-ink/20 pl-3">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>{count} Conversation{count !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {groupSessions ? (
            Array.from(new Set(groupSessions.map((s) => s.agent).filter(Boolean))).map((ag) => (
              <AgentBadge key={ag} agent={ag!} />
            ))
          ) : agent ? (
            <AgentBadge agent={agent} />
          ) : null}
        </div>
      </div>
    </>
  );

  const baseClasses = `group flex flex-col rounded-2xl border bg-white p-5 shadow-material transition-all hover:-translate-y-0.5 hover:shadow-material-lg ${accent}`;
  const borderClass = selected ? "border-ink ring-1 ring-ink" : "border-ink/10";

  if (selectable) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggle?.(!selected);
        }}
        className={`text-left ${baseClasses} ${borderClass}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={`${baseClasses} ${borderClass}`}>
      {content}
    </Link>
  );
}
