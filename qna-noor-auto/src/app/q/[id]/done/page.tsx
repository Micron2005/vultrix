import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { undoScanMove } from "@/app/inventory/actions";

export const dynamic = "force-dynamic";

/**
 * Confirmation page shown after a quick-scan decrement. Reachable from any
 * device (no login) because the QR scanner that got us here was already
 * validated by the signed token check in `/q/[id]/route.ts`.
 */
export default async function QuickScanDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    qty?: string;
    m?: string;
    dup?: string;
    undone?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const moveId = (sp.m ?? "").trim();
  const duplicate = sp.dup === "1";
  const undone = sp.undone === "1";

  const part = await db.part.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      partNumber: true,
      qtyOnHand: true,
      reorderLevel: true,
    },
  });
  if (!part) notFound();

  const qty = part.qtyOnHand;
  const low = qty <= part.reorderLevel;
  const out = qty <= 0;

  return (
    <div className="mx-auto max-w-md px-4 pb-12">
      <div className="py-4 flex items-center justify-between text-xs text-zinc-500">
        <span>Scan result</span>
        <Link
          href={`/s/${id}`}
          className="text-indigo-700 hover:underline"
        >
          More options →
        </Link>
      </div>

      {undone ? (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Undone. Stock is back to its previous value.
        </div>
      ) : duplicate ? (
        <div className="mb-4 rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
          You just scanned this a moment ago — stock wasn&apos;t changed again.
          Scan again in a few seconds to subtract another one.
        </div>
      ) : (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
          Subtracted 1 from stock.
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 mb-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {part.partNumber || "Part"}
        </div>
        <div className="text-lg font-semibold mb-3">{part.name}</div>

        <div className="flex items-baseline gap-2">
          <div className="text-5xl font-bold tabular-nums">{qty}</div>
          <div className="text-sm text-zinc-500">left on hand</div>
        </div>

        {out ? (
          <div className="mt-3 inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
            Out of stock — reorder
          </div>
        ) : low ? (
          <div className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            Low — at or below reorder level ({part.reorderLevel})
          </div>
        ) : null}
      </div>

      {moveId && !undone ? (
        <form action={undoScanMove} className="mb-3">
          <input type="hidden" name="moveId" value={moveId} />
          <input type="hidden" name="partId" value={id} />
          <button
            type="submit"
            className="w-full h-14 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-base font-medium hover:bg-zinc-50 active:scale-[0.99] transition"
          >
            Undo (put 1 back)
          </button>
        </form>
      ) : null}

      <Link
        href={`/s/${id}`}
        className="block w-full h-14 rounded-xl bg-zinc-900 text-white text-base font-semibold hover:bg-zinc-800 active:scale-[0.99] transition flex items-center justify-center"
      >
        More adjustments →
      </Link>

      <div className="mt-6 text-center text-xs text-zinc-400">
        Close this tab when you&apos;re done.
      </div>
    </div>
  );
}
