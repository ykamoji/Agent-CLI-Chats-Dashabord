// Placeholder shown in place of a SessionCard while the dashboard is syncing.
export default function SessionCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-ink/10 bg-white p-5 shadow-material">
      <div className="flex items-start justify-between">
        <div className="h-3 w-16 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-3 animate-pulse rounded-full bg-ink/10" />
      </div>
      <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-ink/10" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-ink/10" />
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-ink/10" />
    </div>
  );
}
