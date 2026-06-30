import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { scanAdjustStock } from "@/app/inventory/actions";

export const dynamic = "force-dynamic";

/**
 * Mobile-friendly QR-scan landing page for a stock part.
 *
 * The QR stickers printed from /inventory/<id>/qr encode the absolute URL
 * to this page. A tech scans the sticker with their phone camera, the page
 * opens (behind the normal session cookie — the middleware blocks anyone
 * not signed in) and they can tap one of the big buttons to record a
 * stock movement.
 *
 * Every action submits to `scanAdjustStock`, which creates a StockMove row
 * so the audit trail on the part detail page stays accurate.
 */
export default async function ScanPartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const justSaved = sp.ok === "1";

  const part = await db.part.findFirst({
    where: { id, orgId },
    include: {
      stockMoves: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  if (!part) notFound();

  const lowStock = part.qtyOnHand <= part.reorderLevel;
  const outOfStock = part.qtyOnHand <= 0;
  // Unit suffix (e.g. " qt") so a barrel of oil reads/deducts in quarts, a
  // box of filters in "each", etc. Empty string when no unit is set.
  const unit = part.unit ? ` ${part.unit}` : "";

  const bound = scanAdjustStock.bind(null, id);

  return (
    <div className="mx-auto max-w-md px-4 pb-12">
      <div className="py-4 flex items-center justify-between text-xs">
        <Link href="/inventory" className="text-indigo-700 hover:underline">
          ← Inventory
        </Link>
        <Link
          href={`/inventory/${id}`}
          className="text-zinc-500 hover:underline"
        >
          Full detail ↗
        </Link>
      </div>

      {justSaved && (
        <div className="mb-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          Saved. Stock updated.
        </div>
      )}

      <div
        className={`rounded-xl border p-5 mb-4 ${
          outOfStock
            ? "border-red-300 bg-red-50"
            : lowStock
              ? "border-amber-300 bg-amber-50"
              : "border-zinc-200 bg-white"
        }`}
      >
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          {part.partNumber ?? "Part"}
        </div>
        <div className="mt-1 text-2xl font-semibold text-zinc-900 leading-tight">
          {part.name}
        </div>
        {part.description && (
          <div className="mt-1 text-sm text-zinc-600 line-clamp-2">
            {part.description}
          </div>
        )}

        <div className="mt-4 flex items-baseline gap-2">
          <span
            className={`text-5xl font-semibold tabular-nums ${
              outOfStock
                ? "text-red-900"
                : lowStock
                  ? "text-amber-900"
                  : "text-zinc-900"
            }`}
          >
            {part.qtyOnHand}
          </span>
          <span className="text-sm text-zinc-600">
            {part.unit ? `${part.unit} on hand` : "on hand"}
          </span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Reorder at or below {part.reorderLevel}
          {outOfStock && " — OUT OF STOCK"}
          {!outOfStock && lowStock && " — LOW"}
        </div>
      </div>

      {/* Big Used -1 button (most common action: you grabbed one, scanned the sticker). */}
      <form action={bound} className="mb-3">
        <input type="hidden" name="delta" value="-1" />
        <input type="hidden" name="reason" value="ADJUST" />
        <input type="hidden" name="note" value="Scan: used 1" />
        <button
          type="submit"
          disabled={outOfStock}
          className="w-full h-16 rounded-xl bg-zinc-900 text-white text-lg font-semibold shadow-sm hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Used 1{unit} &nbsp;→&nbsp; {Math.max(0, part.qtyOnHand - 1)} left
        </button>
      </form>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {[2, 5, 10].map((n) => (
          <form action={bound} key={`use-${n}`}>
            <input type="hidden" name="delta" value={-n} />
            <input type="hidden" name="reason" value="ADJUST" />
            <input type="hidden" name="note" value={`Scan: used ${n}`} />
            <button
              type="submit"
              disabled={part.qtyOnHand < n}
              className="w-full h-12 rounded-lg border border-zinc-300 bg-white text-sm font-medium hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Used {n}{unit}
            </button>
          </form>
        ))}
      </div>

      {/* Free-amount usage — the key flow for bulk liquids (e.g. pull 5 qt from
          an oil barrel). `useQty` is converted to a negative delta server-side. */}
      <form action={bound} className="mb-5">
        <input type="hidden" name="reason" value="ADJUST" />
        <input type="hidden" name="note" value="Scan: used (amount)" />
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Used a specific amount{part.unit ? ` (${part.unit})` : ""}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            name="useQty"
            inputMode="decimal"
            placeholder="e.g. 5"
            min="0"
            step="any"
            className="w-28 h-12 rounded-lg border border-zinc-300 px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <button
            type="submit"
            className="flex-1 h-12 rounded-lg bg-zinc-900 text-white text-base font-semibold hover:bg-zinc-800 active:bg-zinc-700"
          >
            Subtract{unit ? ` ${part.unit}` : ""}
          </button>
        </div>
      </form>

      <form action={bound} className="mb-3">
        <input type="hidden" name="reason" value="RECEIVE" />
        <input type="hidden" name="note" value="Scan: received" />
        <div className="flex gap-2">
          <input
            type="number"
            name="delta"
            inputMode="decimal"
            defaultValue="1"
            min="1"
            step="any"
            className="w-24 h-12 rounded-lg border border-zinc-300 px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="flex-1 h-12 rounded-lg bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 active:bg-emerald-800"
          >
            Received{unit ? ` ${part.unit}` : ""}
          </button>
        </div>
      </form>

      <form action={bound} className="mb-3">
        <input type="hidden" name="reason" value="ADJUST" />
        <input type="hidden" name="note" value="Scan: recount" />
        <div className="flex gap-2">
          <input
            type="number"
            name="setTo"
            inputMode="decimal"
            placeholder="Count"
            step="1"
            min="0"
            className="w-24 h-12 rounded-lg border border-zinc-300 px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="flex-1 h-12 rounded-lg border border-zinc-300 bg-white text-base font-medium hover:bg-zinc-50"
          >
            Set to exact count
          </button>
        </div>
      </form>

      <form action={bound} className="mb-6">
        <input type="hidden" name="delta" value="-1" />
        <input type="hidden" name="reason" value="ADJUST" />
        <div className="flex gap-2">
          <input
            type="text"
            name="note"
            placeholder="Note (optional)"
            className="flex-1 h-10 rounded-lg border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-lg border border-zinc-300 bg-white text-sm font-medium hover:bg-zinc-50"
          >
            Used 1 with note
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
          Recent activity
        </div>
        {part.stockMoves.length === 0 ? (
          <div className="px-4 py-3 text-sm text-zinc-500">
            No moves yet.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {part.stockMoves.map((m) => (
              <li key={m.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-600">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(m.createdAt)}
                  </div>
                  {m.note && (
                    <div className="text-xs text-zinc-500 truncate">
                      {m.note}
                    </div>
                  )}
                </div>
                <div
                  className={`tabular-nums font-semibold ${
                    m.delta > 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
