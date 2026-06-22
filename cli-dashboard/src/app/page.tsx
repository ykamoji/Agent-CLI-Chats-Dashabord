import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-paper text-ink">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-paper">
            &gt;_
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            CLI Dashboard
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/auth?mode=signup"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-material transition-transform hover:-translate-y-0.5"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-20 text-center">
        <span className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          Prompt analytics for vibe coders
        </span>

        <h1 className="animate-fade-up font-display text-5xl  leading-[1.05] tracking-tight text-balance sm:text-7xl">
          See how you talk
          <br />
          to your <span className="italic">agent.</span>
        </h1>

        <p className="mt-8 max-w-2xl animate-fade-up font-display text-xl font-semibold leading-relaxed text-ink-soft text-balance sm:text-2xl">
          This app displays a dashboard of your CLI agent conversation history —
          your input, the tools used, and the output. From that history we surface
          a few key insights so you can understand how to{" "}
          <span className="underline decoration-ink/30 decoration-2 underline-offset-4">
            improve your vibe coding prompts.
          </span>
        </p>

        <div className="mt-10 flex animate-fade-up flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/auth?mode=signup"
            className="rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-paper shadow-material-lg transition-transform hover:-translate-y-0.5"
          >
            Open the dashboard →
          </Link>
          <Link
            href="/auth"
            className="rounded-full border border-ink/15 bg-white px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            I already have an account
          </Link>
          <Link
            href="/dashboard?demo=google_hackathon"
            className="rounded-full border border-ink/15 bg-white px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            Sample Dashboard ✦
          </Link>
        </div>

        {/* Feature triplet */}
        <div className="mt-24 grid w-full animate-fade-up gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 shadow-material sm:grid-cols-3">
          {[
            {
              k: "01",
              t: "Every turn, captured",
              d: "Inputs, tool calls, and outputs from each session in one timeline.",
            },
            {
              k: "02",
              t: "Patterns surfaced",
              d: "Spot which prompts stall, loop, or burn tokens before they cost you.",
            },
            {
              k: "03",
              t: "Prompts, sharpened",
              d: "Actionable insights that nudge your phrasing toward better results.",
            },
          ].map((f) => (
            <div key={f.k} className="bg-white p-6 text-left">
              <div className="font-mono text-xs text-ink-muted">{f.k}</div>
              <h3 className="mt-3 font-display text-lg font-bold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-ink/10 py-8 text-center font-mono text-xs text-ink-muted">
        CLI Dashboard · built for the terminal-native
      </footer>
    </main>
  );
}
