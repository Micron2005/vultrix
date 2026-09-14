import Link from "next/link";

export function SongsTabs({
  active,
}: {
  active: "board" | "ideas" | "practice" | "beats";
}) {
  return (
    <nav
      aria-label="Songs"
      className="mb-6 grid w-full grid-cols-4 gap-1 rounded-lg bg-zinc-100 p-1"
    >
      <Link
        href="/songs"
        aria-current={active === "board" ? "page" : undefined}
        className={
          active === "board"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)] shadow-sm"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Board
      </Link>
      <Link
        href="/songs/ideas"
        aria-current={active === "ideas" ? "page" : undefined}
        className={
          active === "ideas"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)] shadow-sm"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Ideas
      </Link>
      <Link
        href="/songs/practice"
        aria-current={active === "practice" ? "page" : undefined}
        className={
          active === "practice"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)] shadow-sm"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Practice
      </Link>
      <Link
        href="/songs/beats"
        aria-current={active === "beats" ? "page" : undefined}
        className={
          active === "beats"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)] shadow-sm"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Beats
      </Link>
    </nav>
  );
}
