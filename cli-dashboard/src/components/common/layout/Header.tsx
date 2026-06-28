import Link from "next/link";
import UserMenu from "@/components/common/layout/UserMenu";

export type Breadcrumb = {
  label: string;
  href?: string;
  truncate?: boolean;
};

export default function Header({
  isDemo,
  demoUser,
  breadcrumbs = [],
}: {
  isDemo?: boolean;
  demoUser?: string | null;
  breadcrumbs?: Breadcrumb[];
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-paper">
              &gt;_
            </span>
          </Link>
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              {breadcrumbs.map((bc, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                const content = bc.href ? (
                  <Link href={bc.href} className="text-ink-muted transition-colors hover:text-ink">
                    {bc.label}
                  </Link>
                ) : (
                  <span
                    className={bc.truncate ? "truncate max-w-[500px]" : ""}
                    title={bc.truncate ? bc.label : undefined}
                  >
                    {bc.label}
                  </span>
                );

                return (
                  <span key={idx} className="flex items-center gap-2">
                    {content}
                    {!isLast && <span className="text-ink-muted">/</span>}
                  </span>
                );
              })}
            </div>
          )}
        </div>
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
  );
}
