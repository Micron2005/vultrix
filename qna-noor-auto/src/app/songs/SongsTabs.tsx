import Link from "next/link";

export function SongsTabs({
  active,
}: {
  active: "board" | "ideas";
}) {
  return (
    <nav
      aria-label="Songs"
      className="mb-6 grid w-full grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1"
    >
      <Link
        href="/songs"
        aria-current={active === "board" ? "page" : undefined}
        className={
          active === "board"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)]"
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
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)]"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Ideas
      </Link>
    </nav>
  );
}
