import Link from "next/link";
import { Card, CardHeader, Table, TBody, TD, THead, TR, Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";

export async function OutstandingBlock({
  orgId,
  autoShop,
  hasVehicles,
  title,
}: {
  orgId: string;
  autoShop: boolean;
  hasVehicles: boolean;
  title?: string;
}) {
  const outstandingROs = await db.repairOrder.findMany({
    where: { orgId, status: "INVOICED" },
    orderBy: { invoicedAt: "asc" },
    include: {
      customer: true,
      vehicle: true,
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: true,
      feeLines: true,
      payments: true,
    },
  });
  const shopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    outstandingROs.map((ro) => {
      const totals = computeTotals(excludeDeclinedJobLines(ro));
      return {
        id: ro.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    }),
  );
  const outstandingWithBalance = outstandingROs
    .map((ro) => {
      const total = computeTotals({
        ...excludeDeclinedJobLines(ro),
        shopFees: shopFeesByRO.get(ro.id) ?? [],
      }).total;
      const paid = ro.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.round((total - paid) * 100) / 100;
      return { ro, total, paid, balance };
    })
    .filter((item) => item.balance > 0);
  if (outstandingWithBalance.length === 0) return null;
  const moneyOwed = outstandingWithBalance.reduce(
    (sum, item) => sum + item.balance,
    0,
  );

  return (
    <Card className="mb-6 overflow-hidden border-amber-200">
      <CardHeader
        title={
          title ??
          `Outstanding invoices (${outstandingWithBalance.length}) · ${formatMoney(moneyOwed)} owed`
        }
      />
      <Table>
          <THead>
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">{autoShop ? "RO #" : "Invoice #"}</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Customer</th>
              {hasVehicles && <th className="whitespace-nowrap px-4 py-2 font-medium">Vehicle</th>}
              <th className="whitespace-nowrap px-4 py-2 font-medium">Invoiced</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Paid</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
            </tr>
          </THead>
          <TBody>
            {outstandingWithBalance.map(({ ro, total, paid, balance }) => (
              <TR key={ro.id}>
                <TD>
                  <Link
                    href={`/repair-orders/${ro.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    #{ro.roNumber}
                  </Link>
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span>
                      {ro.customer.type === "BUSINESS" && ro.customer.companyName
                        ? ro.customer.companyName
                        : fullName(ro.customer)}
                    </span>
                    <Badge tone={ro.customer.type === "BUSINESS" ? "info" : "neutral"}>
                      {ro.customer.type === "BUSINESS" ? "Business" : "Individual"}
                    </Badge>
                  </div>
                </TD>
                {hasVehicles && <TD>{vehicleLabel(ro.vehicle)}</TD>}
                <TD className="text-zinc-500">
                  {ro.invoicedAt ? formatDate(ro.invoicedAt) : "—"}
                </TD>
                <TD numeric>{formatMoney(total)}</TD>
                <TD numeric className="text-zinc-500">{formatMoney(paid)}</TD>
                <TD numeric className="font-semibold text-red-700">
                  {formatMoney(balance)}
                </TD>
              </TR>
            ))}
          </TBody>
      </Table>
    </Card>
  );
}
