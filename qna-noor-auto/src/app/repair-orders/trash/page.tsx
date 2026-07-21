import Link from "next/link";
import { dbBase } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, fullName, vehicleLabel } from "@/lib/utils";
import { restoreRepairOrder, purgeRepairOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; purged?: string }>;
}) {
  const orgId = await requireOrgId();
  const { error, purged } = await searchParams;

  const ros = await dbBase.repairOrder.findMany({
    where: { orgId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: { customer: true, vehicle: true },
  });

  return (
    <>
      <PageHeader
        title="Trash"
        description="Deleted repair orders are kept here so you can restore them. Nothing is permanently removed unless you purge it below."
      />

      <div className="mb-4">
        <Link
          href="/repair-orders"
          className="text-sm font-medium text-zinc-700 underline"
          data-testid="trash-back"
        >
          &larr; Back to repair orders
        </Link>
      </div>

      {purged === "1" && (
        <div className="mb-4 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-800">
          Repair order permanently deleted.
        </div>
      )}
      {error === "confirm_required" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Type <code>DELETE</code> exactly to permanently remove a ticket.
        </div>
      )}
      {error === "not_found" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          That ticket is no longer in Trash.
        </div>
      )}

      {ros.length === 0 ? (
        <EmptyState
          title="Trash is empty"
          description="Deleted repair orders will appear here."
        />
      ) : (
        <div className="space-y-3">
          {ros.map((ro) => (
            <Card key={ro.id} className="p-4" data-testid={`trash-ro-${ro.roNumber}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">RO #{ro.roNumber}</span>
                    <StatusBadge status={ro.status} />
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">
                    {fullName(ro.customer)}
                    {ro.vehicle && <> · {vehicleLabel(ro.vehicle)}</>}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Opened {formatDate(ro.openedAt)}
                    {ro.deletedAt ? ` · deleted ${formatDate(ro.deletedAt)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={restoreRepairOrder.bind(null, ro.id)}>
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                      data-testid={`trash-restore-${ro.roNumber}`}
                    >
                      Restore
                    </button>
                  </form>
                  <form
                    action={purgeRepairOrder.bind(null, ro.id)}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      name="confirm"
                      placeholder="Type DELETE"
                      autoComplete="off"
                      className="h-9 w-28 rounded border border-zinc-300 px-2 text-xs focus:border-red-500 focus:outline-none"
                      data-testid={`trash-purge-input-${ro.roNumber}`}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      data-testid={`trash-purge-${ro.roNumber}`}
                    >
                      Delete forever
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
