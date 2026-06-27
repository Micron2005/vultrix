import Link from "next/link";

// Persistent, non-alarming banner shown across the whole app while a prospect
// explores the self-resetting live demo (see src/lib/demo.ts). It reassures
// them the data resets and nudges toward a real trial. Sticky on desktop;
// on mobile it sits below the existing fixed top bar (so no overlap) and
// scrolls with the page.
export function DemoBanner() {
  return (
    <div
      role="region"
      aria-label="Demo mode notice"
      data-testid="demo-banner"
      className="z-30 border-b border-amber-200 bg-amber-50 lg:sticky lg:top-0"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <p className="truncate text-sm text-zinc-900">
            <span className="font-semibold" data-testid="demo-banner-title">
              You&apos;re exploring a live demo
            </span>
            <span
              className="hidden text-zinc-600 sm:inline"
              data-testid="demo-banner-subtitle"
            >
              {" "}
              — sample data resets automatically, so click around freely.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/signup"
            data-testid="demo-banner-start-trial-button"
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50"
          >
            Start free trial
          </Link>
          <Link
            href="/demo/exit"
            data-testid="demo-banner-exit-demo-link"
            className="rounded text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 hover:decoration-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50"
          >
            Exit demo
          </Link>
        </div>
      </div>
    </div>
  );
}
