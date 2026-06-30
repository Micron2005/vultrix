import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { scanAdjustStock } from "@/app/inventory/actions";

export const dynamic = "force-dynamic";

/**
 * Bin/shelf QR-scan landing page.
 *
 * Stickers printed from /inventory/bin-qr encode the URL to this page for a
 * given location string (e.g. "Shelf B3"). A tech scans the shelf, sees every
 * part stored there, and taps "Used 1" on the one they pulled — so dozens of
 * small SKUs (e.g. many oil filters) can share a single QR instead of needing
 * an individual sticker each.
 *
 * Login-gated via requireOrgId; results are scoped to the signed-in org and
 * filtered to the location, so two shops can both use "Shelf B3" safely.
 */
export default async function ScanLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ loc: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { loc } = await params;
  const orgId = await requireOrgId();
  const location = decodeURIComponent(loc);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const parts = await db.part.findMany({
    where: {
      orgId,
      location,
      archived: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { partNumber: { contains: q } },
              {
                fitsMake: { contains: q },
              },
              { fitsModel: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  function fitmentLabel(p: (typeof parts)[number]): string {
    const years = [p.fitsYearMin, p.fitsYearMax]
      .filter((n) => n != null)
      .join("–");
    return [years, p.fitsMake, p.fitsModel].filter(Boolean).join(" ");
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-12">
      <div className="py-4 flex items-center justify-between text-xs">
        <Link href="/inventory" className="text-indigo-700 hover:underline">
          ← Inventory
        </Link>
        <span className="text-zinc-400">Bin scan</span>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 mb-4">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Location
        </div>
        <div className="mt-1 text-2xl font-semibold text-zinc-900 leading-tight">
          {location}
        </div>
        <div className="mt-1 text-sm text-zinc-600">
          {parts.length} {parts.length === 1 ? "part" : "parts"} here. Tap the
          one you used.
        </div>
        <form method="get" className="mt-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Filter (name, part #, vehicle)…"
            className="w-full h-11 rounded-lg border border-zinc-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </form>
      </div>

      {parts.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          {q
            ? "No parts here match that filter."
            : "No parts are assigned to this location yet. Set a part's Location to this name to make it show up here."}
        </div>
      ) : (
        <ul className="space-y-3">
          {parts.map((p) => {
            const bound = scanAdjustStock.bind(null, p.id);
            const unit = p.unit ? ` ${p.unit}` : "";
            const fitment = fitmentLabel(p);
            const lowStock = p.qtyOnHand <= p.reorderLevel;
            const outOfStock = p.qtyOnHand <= 0;
            return (
              <li
                key={p.id}
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
                      href={`/inventory/${p.id}`}
                      className="font-semibold text-zinc-900 leading-tight hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {p.partNumber ? `#${p.partNumber}` : null}
                      {p.partNumber && fitment ? " · " : null}
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
                      {p.qtyOnHand}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {p.unit ?? "on hand"}
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
                      value={`Bin scan (${location}): used 1`}
                    />
                    <button
                      type="submit"
                      disabled={outOfStock}
                      className="w-full h-11 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Used 1{unit}
                    </button>
                  </form>
                  <form action={bound} className="col-span-3 flex gap-2">
                    <input type="hidden" name="reason" value="ADJUST" />
                    <input
                      type="hidden"
                      name="note"
                      value={`Bin scan (${location}): used (amount)`}
                    />
                    <input
                      type="number"
                      name="useQty"
                      inputMode="decimal"
                      placeholder={p.unit ? `Amount (${p.unit})` : "Amount"}
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
