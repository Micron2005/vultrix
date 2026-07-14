import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = [
  "ESTIMATE",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "PAID",
  "CANCELLED",
];

// "Open" view hides ROs that no longer need action. PAID and CANCELLED are
// considered settled; everything else is still live work.
const OPEN_STATUSES = ["ESTIMATE", "IN_PROGRESS", "COMPLETED", "INVOICED"];

export default async function RepairOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    view?: string;
    sort?: string;
  }>;
}) {
  const orgId = await requireOrgId();
  const { q, status, view, sort } = await searchParams;
  const query = q?.trim() ?? "";
  const statusFilter = status?.trim();
  const viewMode = view?.trim() || "open"; // "open" | "all"
  const sortMode = sort?.trim() === "oldest" ? "oldest" : "newest";

  // If the query is all digits, treat it as an exact RO-number lookup — that
  // way typing "1234" jumps straight to RO #1234 instead of returning any RO
  // whose complaint/VIN/plate happens to contain "1234".
  const numericQuery =
    query && /^\d+$/.test(query) ? parseInt(query, 10) : null;

  const ros = await db.repairOrder.findMany({
    where: {
      orgId,
      // Explicit status filter wins. Otherwise default to "open only" unless
      // the user picked view=all.
      ...(statusFilter && STATUSES.includes(statusFilter)
        ? { status: statusFilter }
        : viewMode === "all"
          ? {}
          : { status: { in: OPEN_STATUSES } }),
      ...(numericQuery !== null
        ? { roNumber: numericQuery }
        : query
          ? {
              OR: [
                {
                  customer: {
                    lastName: { contains: query, mode: "insensitive" },
                  },
                },
                {
                  customer: {
                    firstName: { contains: query, mode: "insensitive" },
                  },
                },
                {
                  customer: {
                    companyName: { contains: query, mode: "insensitive" },
                  },
                },
                { customer: { phone: { contains: query } } },
                {
                  customer: {
                    email: { contains: query, mode: "insensitive" },
                  },
                },
                { vehicle: { vin: { contains: query, mode: "insensitive" } } },
                {
                  vehicle: {
                    licensePlate: { contains: query, mode: "insensitive" },
                  },
                },
                { complaint: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
    },
    include: {
      customer: true,
      vehicle: true,
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: true,
      feeLines: true,
    },
    orderBy: { openedAt: sortMode === "oldest" ? "asc" : "desc" },
    take: 200,
  });

  const shopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    ros.map((ro) => {
      const t = computeTotals(excludeDeclinedJobLines(ro));
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );

  return (
    <>
      <PageHeader
        title="Repair Orders"
        description="All repair orders across the shop"
        actions={
          <div className="flex gap-2">
            <Link
              href="/repair-orders/trash"
              className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              data-testid="repair-orders-trash-link"
            >
              Trash
            </Link>
            <Link
              href="/repair-orders/duplicates"
              className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              Review duplicates
            </Link>
            <LinkButton href="/repair-orders/new">New RO</LinkButton>
          </div>
        }
      />

      <form
        className="mb-4 flex flex-wrap items-center gap-2 max-w-3xl"
        method="GET"
      >
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search RO #, customer, company, VIN, plate, complaint…"
          className="flex-1 min-w-[16rem]"
        />
        <Select name="view" defaultValue={viewMode}>
          <option value="open">Open only (hide paid/cancelled)</option>
          <option value="all">All ROs (include paid/cancelled)</option>
        </Select>
        <Select name="sort" defaultValue={sortMode}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
        <Select name="status" defaultValue={statusFilter ?? ""}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
        >
          Apply
        </button>
      </form>
      {viewMode !== "all" && !statusFilter && (
        <p className="-mt-2 mb-4 text-xs text-zinc-500">
          Showing open repair orders only. Paid and cancelled ROs are hidden —
          switch to &quot;All ROs&quot; or pick a specific status to see them.
        </p>
      )}

      {ros.length === 0 ? (
        <EmptyState
          title={
            query || statusFilter
              ? "No ROs matched your filters"
              : "No repair orders yet"
          }
          description={
            query || statusFilter
              ? undefined
              : "Create your first repair order to get started."
          }
          action={<LinkButton href="/repair-orders/new">New RO</LinkButton>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">RO #</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Complaint</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Opened</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {ros.map((ro) => {
                const shopFees = shopFeesByRO.get(ro.id) ?? [];
                const { total } = computeTotals({ ...excludeDeclinedJobLines(ro), shopFees });
                return (
                  <tr key={ro.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/repair-orders/${ro.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        #{ro.roNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{fullName(ro.customer)}</td>
                    <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>
                    <td className="px-4 py-2 text-zinc-600 max-w-xs truncate">
                      {ro.complaint ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={ro.status} />
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {formatDate(ro.openedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatMoney(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
