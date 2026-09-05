import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { scanAdjustStock } from "@/app/inventory/actions";

export const dynamic = "force-dynamic";

/** Category QR-scan landing page for selecting and adjusting a part. */
export default async function ScanCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ cat: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { cat } = await params;
  const orgId = await requireOrgId();
  const category = decodeURIComponent(cat);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const parts = await db.part.findMany({
    where: {
      orgId,
      category,
      archived: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { partNumber: { contains: q } },
              { source: { contains: q } },
              { fitsMake: { contains: q } },
              { fitsModel: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
  });

  function fitmentLabel(part: (typeof parts)[number]): string {
    const years = [part.fitsYearMin, part.fitsYearMax]
      .filter((year) => year != null)
      .join("–");
    return [years, part.fitsMake, part.fitsModel].filter(Boolean).join(" ");
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-12">
      <div className="py-4 flex items-center justify-between text-xs">
        <Link href="/inventory" className="text-indigo-700 hover:underline">
          ← Inventory
        </Link>
        <span className="text-zinc-400">Category scan</span>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 mb-4">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Category
        </div>
        <div className="mt-1 text-2xl font-semibold text-zinc-900 leading-tight">
          {category}
        </div>
        <div className="mt-1 text-sm text-zinc-600">
          {parts.length} {parts.length === 1 ? "part" : "parts"} here. Tap the
          one you want to adjust.
        </div>
        <form method="get" className="mt-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Filter (name, part #, supplier, vehicle)…"
            className="w-full h-11 rounded-lg border border-zinc-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </form>
      </div>

      <Link
        href={`/inventory/new?category=${encodeURIComponent(category)}`}
        className="mb-4 block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-medium text-indigo-800 hover:bg-indigo-100"
      >
        + Add a new part to {category}
      </Link>

      {parts.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          {q
            ? "No parts here match that filter."
            : "No parts are assigned to this category yet. Add one above."}
        </div>
      ) : (
        <ul className="space-y-3">
          {parts.map((part) => {
            const bound = scanAdjustStock.bind(null, part.id);
            const unit = part.unit ? ` ${part.unit}` : "";
            const fitment = fitmentLabel(part);
            const lowStock = part.qtyOnHand <= part.reorderLevel;
            const outOfStock = part.qtyOnHand <= 0;
            return (
              <li
                key={part.id}
                className={`rounded-xl border p-4 ${
                  outOfStock
                    ? "border-red-300 bg-red-50"
                    : lowStock
                      ? "border-amber-300 bg-amber-50"
                      : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/inventory/${part.id}`}
                      className="font-semibold text-zinc-900 leading-tight hover:underline"
                    >
                      {part.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {part.partNumber ? `#${part.partNumber}` : null}
                      {part.partNumber && fitment ? " · " : null}
                      {fitment || null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-2xl font-semibold tabular-nums ${
                        outOfStock
                          ? "text-red-900"
                          : lowStock
                            ? "text-amber-900"
                            : "text-zinc-900"
                      }`}
                    >
                      {part.qtyOnHand}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {part.unit ?? "on hand"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <form action={bound} className="col-span-1">
                    <input type="hidden" name="delta" value="-1" />
                    <input type="hidden" name="reason" value="ADJUST" />
                    <input
                      type="hidden"
                      name="note"
                      value={`Category scan (${category}): used 1`}
                    />
                    <button
                      type="submit"
                      disabled={outOfStock}
                      className="w-full h-11 rounded-lg bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] text-sm font-semibold hover:bg-[var(--vx-accent-700)] active:bg-[var(--vx-accent-700)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Used 1{unit}
                    </button>
                  </form>
                  <form action={bound} className="col-span-3 flex gap-2">
                    <input type="hidden" name="reason" value="ADJUST" />
                    <input
                      type="hidden"
                      name="note"
                      value={`Category scan (${category}): used (amount)`}
                    />
                    <input
                      type="number"
                      name="useQty"
                      inputMode="decimal"
                      placeholder={part.unit ? `Amount (${part.unit})` : "Amount"}
                      min="0"
                      step="any"
                      className="w-full h-11 rounded-lg border border-zinc-300 px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                    <button
                      type="submit"
                      className="shrink-0 h-11 px-4 rounded-lg border border-zinc-300 bg-white text-sm font-medium hover:bg-zinc-50"
                    >
                      Subtract
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
