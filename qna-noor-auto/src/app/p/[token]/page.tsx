import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/shop";
import { computeTotals } from "@/lib/totals";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import { computeVehicleReminders } from "@/lib/serviceReminders";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export default async function CustomerPortalPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;

  const customer = await db.customer.findUnique({
    where: { portalToken: token },
    include: {
      vehicles: {
        orderBy: { createdAt: "desc" },
      },
      repairOrders: {
        orderBy: { openedAt: "desc" },
        include: {
          vehicle: true,
          laborLines: { orderBy: { sortOrder: "asc" } },
          partLines: { orderBy: { sortOrder: "asc" } },
          feeLines: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { paidAt: "desc" } },
        },
      },
    },
  });

  if (!customer) notFound();

  const shop = await getAllSettings();

  type ROWithDerived = (typeof customer.repairOrders)[number] & {
    total: number;
    paid: number;
    balance: number;
  };

  const rosWithDerived: ROWithDerived[] = customer.repairOrders.map((ro) => {
    const total = computeTotals(ro).total;
    const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    return { ...ro, total, paid, balance };
  });

  const outstanding = rosWithDerived.filter(
    (ro) => ro.status === "INVOICED" && ro.balance > 0,
  );
  const totalOutstanding = outstanding.reduce((s, ro) => s + ro.balance, 0);

  const pendingEstimates = rosWithDerived.filter(
    (ro) =>
      ro.status === "ESTIMATE" &&
      ro.shareToken &&
      !ro.approvedAt &&
      !ro.estimateDeclinedAt,
  );

  const serviceHistory = rosWithDerived.filter(
    (ro) => ro.status === "PAID" || ro.status === "COMPLETED" || ro.status === "INVOICED",
  );

  const vehicleReminders = await Promise.all(
    customer.vehicles.map((v) => computeVehicleReminders(v.id)),
  );
  const dueVehicles = vehicleReminders
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      ...r,
      dueItems: r.items.filter(
        (i) => i.status === "overdue" || i.status === "soon",
      ),
    }))
    .filter((r) => r.dueItems.length > 0);

  return (
    <div className="min-h-screen bg-zinc-100 py-10">
      <div className="mx-auto max-w-4xl px-4 space-y-6">
        <header className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-zinc-200 flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-zinc-900">
                {shop.shopName}
              </div>
              {shop.shopAddress && (
                <div className="mt-0.5 text-xs text-zinc-600 whitespace-pre-line">
                  {shop.shopAddress}
                </div>
              )}
              {(shop.shopPhone || shop.shopEmail) && (
                <div className="mt-0.5 text-xs text-zinc-600">
                  {[shop.shopPhone, shop.shopEmail].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Welcome
              </div>
              <div className="text-xl font-semibold text-zinc-900">
                {fullName(customer)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {[customer.phone, customer.email].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        </header>

        {totalOutstanding > 0 && (
          <section className="rounded-lg bg-amber-50 border border-amber-300 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-900 font-semibold">
                  Balance due
                </div>
                <div className="mt-1 text-2xl font-semibold text-amber-900 tabular-nums">
                  {formatMoney(totalOutstanding)}
                </div>
                <div className="mt-1 text-xs text-amber-800">
                  Across {outstanding.length} invoice
                  {outstanding.length === 1 ? "" : "s"}.
                </div>
              </div>
            </div>
          </section>
        )}

        {pendingEstimates.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Pending estimates ({pendingEstimates.length})
            </div>
            <ul className="divide-y divide-zinc-200">
              {pendingEstimates.map((ro) => (
                <li
                  key={ro.id}
                  className="px-6 py-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-900">
                      {vehicleLabel(ro.vehicle)}
                    </div>
                    {ro.complaint && (
                      <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1">
                        {ro.complaint}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {formatDate(ro.openedAt)} · {formatMoney(ro.total)}
                    </div>
                  </div>
                  <Link
                    href={`/e/${ro.shareToken}`}
                    className="inline-flex h-8 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Review estimate →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {dueVehicles.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Recommended next service
            </div>
            <ul className="divide-y divide-zinc-200">
              {dueVehicles.map((r) => (
                <li key={r.vehicle.id} className="px-6 py-4">
                  <div className="text-sm font-medium text-zinc-900">
                    {vehicleLabel(r.vehicle)}
                    {r.vehicle.licensePlate && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {r.vehicle.licensePlate}
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {r.dueItems.map((i) => (
                      <li
                        key={i.interval.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-zinc-800">
                          {i.interval.label}
                        </span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider text-[10px] " +
                            (i.status === "overdue"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800")
                          }
                        >
                          {i.status === "overdue" ? "Overdue" : "Due soon"}
                          {i.summary ? ` · ${i.summary}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="px-6 py-2 text-[11px] text-zinc-500 border-t border-zinc-200">
              Based on your vehicle's mileage and last known service. Contact
              us to schedule.
            </div>
          </section>
        )}

        <section className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
            My vehicles ({customer.vehicles.length})
          </div>
          {customer.vehicles.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              No vehicles on file.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {customer.vehicles.map((v) => (
                <li key={v.id} className="px-6 py-3">
                  <div className="text-sm font-medium text-zinc-900">
                    {vehicleLabel(v)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {v.licensePlate && (
                      <span className="mr-3">Plate: {v.licensePlate}</span>
                    )}
                    {v.vin && (
                      <span className="mr-3 font-mono">VIN: {v.vin}</span>
                    )}
                    {typeof v.mileage === "number" && (
                      <span>Mileage: {v.mileage.toLocaleString()}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {outstanding.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Outstanding invoices ({outstanding.length})
            </div>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-600">
                <tr>
                  <th className="px-6 py-2">Invoice</th>
                  <th className="px-4 py-2">Vehicle</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {outstanding.map((ro) => (
                  <tr key={ro.id}>
                    <td className="px-6 py-2">
                      <Link
                        href={`/p/${token}/ro/${ro.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        #{ro.roNumber}
                      </Link>
                      <div className="text-xs text-zinc-500">
                        Invoiced {formatDate(ro.invoicedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {vehicleLabel(ro.vehicle)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-700 tabular-nums">
                      {formatMoney(ro.total)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600 tabular-nums">
                      {formatMoney(ro.paid)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-amber-900">
                      {formatMoney(ro.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
            Service history ({serviceHistory.length})
          </div>
          {serviceHistory.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              No service history yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-600">
                <tr>
                  <th className="px-6 py-2">Date</th>
                  <th className="px-4 py-2">RO</th>
                  <th className="px-4 py-2">Vehicle</th>
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {serviceHistory.map((ro) => (
                  <tr key={ro.id}>
                    <td className="px-6 py-2 text-zinc-600">
                      {formatDate(ro.closedAt ?? ro.invoicedAt ?? ro.openedAt)}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/p/${token}/ro/${ro.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        #{ro.roNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {vehicleLabel(ro.vehicle)}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 max-w-[260px] truncate">
                      {ro.complaint ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">
                      {ro.status === "PAID"
                        ? "Paid"
                        : ro.status === "COMPLETED"
                          ? "Completed"
                          : "Invoiced"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatMoney(ro.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="text-center text-xs text-zinc-500 pt-2">
          Questions? Contact{" "}
          {shop.shopPhone || shop.shopEmail || shop.shopName}.
        </footer>
      </div>
    </div>
  );
}
