import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">{autoShop ? "RO #" : "Invoice #"}</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Customer</th>
              {hasVehicles && <th className="whitespace-nowrap px-4 py-2 font-medium">Vehicle</th>}
              <th className="whitespace-nowrap px-4 py-2 font-medium">Invoiced</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Paid</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {outstandingWithBalance.map(({ ro, total, paid, balance }) => (
              <tr key={ro.id} className="hover:bg-zinc-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/repair-orders/${ro.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    #{ro.roNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span>
                      {ro.customer.type === "BUSINESS" && ro.customer.companyName
                        ? ro.customer.companyName
                        : fullName(ro.customer)}
                    </span>
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                        (ro.customer.type === "BUSINESS"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-zinc-100 text-zinc-600")
                      }
                    >
                      {ro.customer.type === "BUSINESS" ? "Business" : "Individual"}
                    </span>
                  </div>
                </td>
                {hasVehicles && <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>}
                <td className="px-4 py-2 text-zinc-500">
                  {ro.invoicedAt ? formatDate(ro.invoicedAt) : "—"}
                </td>
                <td className="px-4 py-2 text-right">{formatMoney(total)}</td>
                <td className="px-4 py-2 text-right text-zinc-500">{formatMoney(paid)}</td>
                <td className="px-4 py-2 text-right font-semibold text-red-700">
                  {formatMoney(balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
