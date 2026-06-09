import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import { deleteFromDuplicates } from "./actions";

export const dynamic = "force-dynamic";

// Short filler words the fuzzy match ignores. Anything ≥ 4 chars and not in
// this list counts as a "significant word" for overlap detection. Kept in
// sync with src/lib/duplicates.ts.
const STOP_WORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "they",
  "have",
  "your",
  "into",
  "also",
  "then",
  "than",
  "some",
  "more",
  "just",
  "only",
  "each",
  "over",
  "under",
  "when",
  "what",
  "need",
  "needs",
  "needed",
  "check",
  "checked",
  "work",
  "does",
  "doing",
  "done",
  "front",
  "rear",
  "left",
  "right",
  "both",
  "side",
  "sides",
  "service",
  "services",
  "other",
  "per",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

type ROWithRelations = Awaited<ReturnType<typeof loadROs>>[number];

async function loadROs(orgId: string) {
  // Include PAID (and paid-then-cleared) ROs so the shop can see a vehicle's
  // past work history right next to a new/active ticket and judge whether the
  // new job duplicates one that was already done and paid for. Clusters that
  // contain ONLY settled ROs are filtered out later (see clusterROs) so the
  // page stays focused on groups that still have an actionable ticket.
  // CANCELLED ROs remain hidden — they were never real work.
  return db.repairOrder.findMany({
    where: { orgId, status: { not: "CANCELLED" } },
    orderBy: { openedAt: "desc" },
    include: {
      customer: true,
      vehicle: true,
      laborLines: { orderBy: { sortOrder: "asc" } },
      partLines: true,
      feeLines: true,
      payments: true,
    },
  });
}

type Cluster = {
  vehicleId: string;
  customerId: string;
  customerLabel: string;
  vehicleLabelStr: string;
  ros: ROWithRelations[];
  sharedWords: string[];
};

// Identity key for "the same physical car". The same vehicle is often entered
// as separate Vehicle records over time (especially for dealers with lots of
// cars), so grouping strictly by vehicleId misses real duplicates. Prefer the
// VIN, then license plate, and fall back to the vehicleId when neither is
// recorded. Everything is scoped to the customer so two different customers
// who happen to share a VIN/plate (e.g. a car traded between them) never get
// merged into one group — the cluster header only shows a single customer, so
// cross-customer merging would be misleading.
function vehicleIdentityKey(ro: ROWithRelations): string {
  const vin = ro.vehicle.vin?.replace(/\s/g, "").toUpperCase();
  if (vin) return `cust:${ro.customerId}|vin:${vin}`;
  const plate = ro.vehicle.licensePlate?.replace(/\s/g, "").toUpperCase();
  if (plate) return `cust:${ro.customerId}|plate:${plate}`;
  return `veh:${ro.vehicleId}`;
}

function clusterROs(ros: ROWithRelations[]): Cluster[] {
  // Group by the car's identity (VIN / plate / vehicleId) so the same physical
  // car spread across multiple Vehicle records still clusters together.
  const byVehicle = new Map<string, ROWithRelations[]>();
  for (const ro of ros) {
    const key = vehicleIdentityKey(ro);
    const list = byVehicle.get(key) ?? [];
    list.push(ro);
    byVehicle.set(key, list);
  }

  const clusters: Cluster[] = [];
  for (const list of byVehicle.values()) {
    if (list.length < 2) continue;

    // Within this vehicle, do a simple union-find on fuzzy labor overlap.
    const tokensPerRO: Set<string>[] = list.map(
      (ro) =>
        new Set(
          ro.laborLines.flatMap((l) => tokenize(l.description ?? "")),
        ),
    );

    const parent = list.map((_, i) => i);
    const find = (x: number): number =>
      parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = tokensPerRO[i];
        const b = tokensPerRO[j];
        // A ticket with no labor lines yet (e.g. a freshly started RO) is a
        // wildcard: there's nothing to fuzzy-match on, so we can't rule out a
        // duplicate. Union it with every other ticket on the same vehicle so
        // the car's history — including past paid/cleared tickets — shows up
        // for comparison before the user adds the job.
        if (a.size === 0 || b.size === 0) {
          union(i, j);
          continue;
        }
        let overlap = false;
        for (const t of a) {
          if (b.has(t)) {
            overlap = true;
            break;
          }
        }
        if (overlap) union(i, j);
      }
    }

    const groups = new Map<number, number[]>();
    for (let i = 0; i < list.length; i++) {
      const r = find(i);
      const g = groups.get(r) ?? [];
      g.push(i);
      groups.set(r, g);
    }

    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const mros = members.map((i) => list[i]);
      // Only surface clusters that still have at least one actionable ticket
      // (anything not already PAID). A group of only paid/closed ROs is just
      // history with nothing to fix, so skip it.
      if (mros.every((r) => r.status === "PAID")) continue;
      // Shared words: intersection of all member token sets (nice summary).
      const firstTokens = tokensPerRO[members[0]];
      const intersection = new Set(firstTokens);
      for (let k = 1; k < members.length; k++) {
        const other = tokensPerRO[members[k]];
        for (const t of intersection) {
          if (!other.has(t)) intersection.delete(t);
        }
      }
      const sample = mros[0];
      clusters.push({
        vehicleId: sample.vehicleId,
        customerId: sample.customerId,
        customerLabel: fullName(sample.customer),
        vehicleLabelStr: vehicleLabel(sample.vehicle),
        ros: mros.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime()),
        sharedWords: Array.from(intersection),
      });
    }
  }
  // Show clusters sorted by most recent RO first.
  clusters.sort((a, b) => {
    const am = Math.max(...a.ros.map((r) => r.openedAt.getTime()));
    const bm = Math.max(...b.ros.map((r) => r.openedAt.getTime()));
    return bm - am;
  });
  return clusters;
}

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  const orgId = await requireOrgId();
  const { deleted, error } = await searchParams;
  const ros = await loadROs(orgId);
  const clusters = clusterROs(ros);
  const shopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    ros.map((ro) => {
      const t = computeTotals(ro);
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );

  return (
    <>
      <PageHeader
        title="Duplicate review"
        description="Repair orders grouped by vehicle that share overlapping jobs. Past paid/cleared tickets are shown for reference so you can tell if a new ticket repeats earlier work. CANCELLED ROs are ignored."
      />

      {deleted === "1" && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Repair order deleted.
        </div>
      )}
      {error === "confirm_required" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Delete was not confirmed. Type <code>DELETE</code> exactly in the
          confirmation box to remove a repair order.
        </div>
      )}
      {error === "not_found" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          That repair order no longer exists.
        </div>
      )}
      {error === "paid_locked" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          That repair order is paid and can&apos;t be deleted here — paid
          tickets are shown for reference only.
        </div>
      )}

      {clusters.length === 0 ? (
        <Card className="p-6 text-sm text-zinc-600">
          No duplicate groups found. All repair orders look unique per vehicle.
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            Found {clusters.length} group{clusters.length === 1 ? "" : "s"} that
            may contain duplicates.
          </div>
          {clusters.map((c, idx) => (
            <Card key={`${c.vehicleId}-${idx}`} className="overflow-hidden">
              <CardHeader
                title={`${c.customerLabel} · ${c.vehicleLabelStr}`}
              />
              <div className="p-4 space-y-3">
                {c.sharedWords.length > 0 && (
                  <div className="text-xs text-zinc-600">
                    Shared job terms:{" "}
                    <span className="font-medium">
                      {c.sharedWords.join(", ")}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {c.ros.map((ro) => {
                    const shopFees = shopFeesByRO.get(ro.id) ?? [];
                    const totals = computeTotals({ ...ro, shopFees });
                    const paid = ro.payments.reduce(
                      (s, p) => s + p.amount,
                      0,
                    );
                    return (
                      <div
                        key={ro.id}
                        className="rounded-md border border-zinc-200 p-3 bg-zinc-50"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/repair-orders/${ro.id}`}
                            className="font-mono font-semibold underline underline-offset-2"
                          >
                            RO #{ro.roNumber}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={ro.status} />
                            {ro.clearedAt && (
                              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                                Cleared
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Opened {formatDate(ro.openedAt)}
                        </div>
                        <div className="mt-2 text-sm text-zinc-900">
                          {ro.laborLines.length === 0 ? (
                            <span className="italic text-zinc-500">
                              {ro.complaint?.trim() || "(no labor lines yet)"}
                            </span>
                          ) : (
                            <ul className="list-disc pl-5 space-y-0.5">
                              {ro.laborLines.slice(0, 4).map((l) => (
                                <li key={l.id}>{l.description}</li>
                              ))}
                              {ro.laborLines.length > 4 && (
                                <li className="text-zinc-500">
                                  +{ro.laborLines.length - 4} more
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-700">
                          <span>Total: {formatMoney(totals.total)}</span>
                          <span>Paid: {formatMoney(paid)}</span>
                          <span>
                            Parts: {ro.partLines.length} · Fees:{" "}
                            {ro.feeLines.length}
                          </span>
                        </div>
                        {ro.status === "PAID" ? (
                          <div className="mt-3 text-xs italic text-zinc-500">
                            Paid ticket — shown for reference. Closed books are
                            not deleted here.
                          </div>
                        ) : (
                          <form
                            action={deleteFromDuplicates.bind(null, ro.id)}
                            className="mt-3 flex items-center gap-2"
                          >
                            <input
                              type="text"
                              name="confirm"
                              placeholder="Type DELETE"
                              autoComplete="off"
                              className="h-8 w-32 rounded border border-zinc-300 px-2 text-xs focus:border-red-500 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="h-8 px-3 text-xs rounded bg-red-600 text-white hover:bg-red-700 font-medium"
                            >
                              Delete this RO
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
