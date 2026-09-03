import Link from "next/link";
import { Card, CardHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";

export async function RecentRecordsBlock({
  orgId,
  autoShop,
  nouns,
  hasVehicles,
  take = 8,
  title,
}: {
  orgId: string;
  autoShop: boolean;
  nouns: { singular: string; plural: string };
  hasVehicles: boolean;
  take?: number;
  title?: string;
}) {
  const recentROs = await db.repairOrder.findMany({
    where: { orgId },
    orderBy: { openedAt: "desc" },
    take,
    include: {
      customer: true,
      vehicle: true,
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: true,
      feeLines: true,
    },
  });
  const shopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    recentROs.map((ro) => {
      const totals = computeTotals(excludeDeclinedJobLines(ro));
      return {
        id: ro.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    }),
  );

  return (
    <Card className="mb-6">
      <CardHeader title={title ?? (autoShop ? "Recent Repair Orders" : `Recent ${nouns.plural}`)}>
        <Link href="/repair-orders" className="text-xs font-medium text-zinc-600 underline">
          View all →
        </Link>
      </CardHeader>
      {recentROs.length === 0 ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          {autoShop ? "No repair orders yet. " : "No invoices yet. "}
          <Link href="/repair-orders/new" className="underline">
            {autoShop ? "Create your first RO" : "Create your first invoice"}
          </Link>
          .
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">{autoShop ? "RO #" : "Invoice #"}</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              {hasVehicles && <th className="px-4 py-2 font-medium">Vehicle</th>}
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Opened</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {recentROs.map((ro) => {
              const totals = computeTotals({
                ...excludeDeclinedJobLines(ro),
                shopFees: shopFeesByRO.get(ro.id) ?? [],
              });
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
                  {hasVehicles && <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>}
                  <td className="px-4 py-2"><StatusBadge status={ro.status} /></td>
                  <td className="px-4 py-2 text-zinc-500">{formatDate(ro.openedAt)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(totals.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
