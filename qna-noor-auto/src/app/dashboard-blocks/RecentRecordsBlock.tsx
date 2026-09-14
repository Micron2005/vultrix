import Link from "next/link";
import { Card, CardHeader, EmptyState, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";
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
        <EmptyState
          title={autoShop ? "No repair orders yet" : "No invoices yet"}
          action={
            <Link href="/repair-orders/new" className="text-sm font-medium text-[var(--vx-accent-700)] hover:underline">
              {autoShop ? "Create your first RO" : "Create your first invoice"}
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <th className="px-4 py-2 font-medium">{autoShop ? "RO #" : "Invoice #"}</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              {hasVehicles && <th className="px-4 py-2 font-medium">Vehicle</th>}
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Opened</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </THead>
          <TBody>
            {recentROs.map((ro) => {
              const totals = computeTotals({
                ...excludeDeclinedJobLines(ro),
                shopFees: shopFeesByRO.get(ro.id) ?? [],
              });
              return (
                <TR key={ro.id}>
                  <TD>
                    <Link
                      href={`/repair-orders/${ro.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      #{ro.roNumber}
                    </Link>
                  </TD>
                  <TD>{fullName(ro.customer)}</TD>
                  {hasVehicles && <TD>{vehicleLabel(ro.vehicle)}</TD>}
                  <TD><StatusBadge status={ro.status} /></TD>
                  <TD className="text-zinc-500">{formatDate(ro.openedAt)}</TD>
                  <TD numeric>{formatMoney(totals.total)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
