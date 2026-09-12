import Link from "next/link";

export function IntelTabs({
  active,
}: {
  active: "lookup" | "notes";
}) {
  return (
    <nav
      aria-label="Vehicle intel"
      className="mb-6 grid w-full grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1"
    >
      <Link
        href="/intel"
        aria-current={active === "lookup" ? "page" : undefined}
        className={
          active === "lookup"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)]"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Vehicle lookup
      </Link>
      <Link
        href="/notes"
        aria-current={active === "notes" ? "page" : undefined}
        className={
          active === "notes"
            ? "inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-center text-xs font-medium text-[var(--vx-accent-fg)]"
            : "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-white"
        }
      >
        Knowledge notes
      </Link>
    </nav>
  );
}
