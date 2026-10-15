import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

export async function SongsTabs({
  active,
}: {
  active: "board" | "lyrics" | "ideas" | "practice" | "beats";
}) {
  const user = await getCurrentUser();
  return (
    <>
      {user?.musicAccess.reason === "grace" && user.musicAccess.graceUntil && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Music is free until{" "}
          {user.musicAccess.graceUntil.toLocaleDateString()}. Add the Music
          add-on in{" "}
          <Link href="/billing#music" className="font-medium underline">
            Billing
          </Link>{" "}
          to keep it.
        </div>
      )}
      <nav
        aria-label="Songs"
        className="mb-6 grid w-full grid-cols-5 gap-1 rounded-lg bg-zinc-100 p-1"
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
        href="/songs/lyrics"
        aria-current={active === "lyrics" ? "page" : undefined}
        className={
          active === "lyrics"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)] shadow-sm"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Lyrics
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
    </>
  );
}
