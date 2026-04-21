import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/shop";
import { computeTotals } from "@/lib/totals";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string; roId: string }>;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  CHECK: "Check",
  TRANSFER: "Transfer",
  OTHER: "Other",
};

export default async function CustomerPortalROPage({
  params,
}: {
  params: Params;
}) {
  const { token, roId } = await params;

  const customer = await db.customer.findUnique({
    where: { portalToken: token },
    select: { id: true, firstName: true, lastName: true, companyName: true },
  });
  if (!customer) notFound();

  const ro = await db.repairOrder.findUnique({
    where: { id: roId },
    include: {
      customer: true,
      vehicle: true,
      laborLines: { orderBy: { sortOrder: "asc" } },
      partLines: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!ro || ro.customerId !== customer.id) notFound();

  const shop = await getAllSettings();
  const totals = computeTotals(ro);
  const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((totals.total - paid) * 100) / 100);

  const isInvoiced =
    ro.status === "INVOICED" ||
    ro.status === "PAID" ||
    ro.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-zinc-100 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4">
          <Link
            href={`/p/${token}`}
            className="text-xs text-zinc-600 hover:text-zinc-900"
          >
            ← Back to my account
          </Link>
        </div>

        <div className="rounded-lg bg-white shadow-sm overflow-hidden">
          <header className="px-8 py-6 border-b border-zinc-200">
            <div className="flex items-start justify-between gap-4">
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
                    {[shop.shopPhone, shop.shopEmail]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  {ro.status === "PAID"
                    ? "Receipt"
                    : isInvoiced
                      ? "Invoice"
                      : "Estimate"}
                </div>
                <div className="text-2xl font-semibold text-zinc-900 tabular-nums">
                  #{ro.roNumber}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {formatDate(ro.openedAt)}
                </div>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 px-8 py-6 border-b border-zinc-200 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                Prepared for
              </div>
              <div className="font-medium text-zinc-900">
                {fullName(ro.customer)}
              </div>
              {ro.customer.phone && (
                <div className="text-zinc-600">{ro.customer.phone}</div>
              )}
              {ro.customer.email && (
                <div className="text-zinc-600">{ro.customer.email}</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                Vehicle
              </div>
              <div className="font-medium text-zinc-900">
                {vehicleLabel(ro.vehicle)}
              </div>
              {ro.vehicle.licensePlate && (
                <div className="text-zinc-600">
                  Plate: {ro.vehicle.licensePlate}
                </div>
              )}
              {ro.vehicle.vin && (
                <div className="font-mono text-xs text-zinc-500">
                  VIN: {ro.vehicle.vin}
                </div>
              )}
              {typeof ro.mileageIn === "number" && (
                <div className="text-zinc-600">
                  Mileage in: {ro.mileageIn.toLocaleString()}
                </div>
              )}
              {typeof ro.mileageOut === "number" && (
                <div className="text-zinc-600">
                  Mileage out: {ro.mileageOut.toLocaleString()}
                </div>
              )}
            </div>
          </section>

          {ro.complaint && (
            <section className="px-8 py-6 border-b border-zinc-200 text-sm">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                Concern
              </div>
              <div className="text-zinc-800 whitespace-pre-line">
                {ro.complaint}
              </div>
            </section>
          )}

          {ro.correction && (
            <section className="px-8 py-6 border-b border-zinc-200 text-sm">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                Work performed
              </div>
              <div className="text-zinc-800 whitespace-pre-line">
                {ro.correction}
              </div>
            </section>
          )}

          {ro.laborLines.length > 0 && (
            <section className="px-8 py-4 border-b border-zinc-200">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                Labor
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1">Description</th>
                    <th className="py-1 text-right">Hours</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ro.laborLines.map((l) => (
                    <tr key={l.id} className="border-t border-zinc-100">
                      <td className="py-2 text-zinc-800">{l.description}</td>
                      <td className="py-2 text-right text-zinc-700 tabular-nums">
                        {l.hours.toFixed(1)}
                      </td>
                      <td className="py-2 text-right text-zinc-700 tabular-nums">
                        {formatMoney(l.rate)}
                      </td>
                      <td className="py-2 text-right text-zinc-900 tabular-nums">
                        {formatMoney(l.hours * l.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {ro.partLines.length > 0 && (
            <section className="px-8 py-4 border-b border-zinc-200">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                Parts
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1">Description</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ro.partLines.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-100">
                      <td className="py-2 text-zinc-800">{p.description}</td>
                      <td className="py-2 text-right text-zinc-700 tabular-nums">
                        {p.quantity}
                      </td>
                      <td className="py-2 text-right text-zinc-700 tabular-nums">
                        {formatMoney(p.unitPrice)}
                      </td>
                      <td className="py-2 text-right text-zinc-900 tabular-nums">
                        {formatMoney(p.quantity * p.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="px-8 py-4 border-b border-zinc-200">
            <div className="flex justify-end">
              <dl className="w-72 text-sm space-y-1">
                <div className="flex justify-between text-zinc-600">
                  <dt>Labor</dt>
                  <dd className="tabular-nums">
                    {formatMoney(totals.laborSubtotal)}
                  </dd>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <dt>Parts</dt>
                  <dd className="tabular-nums">
                    {formatMoney(totals.partsSubtotal)}
                  </dd>
                </div>
                <div className="flex justify-between text-zinc-700">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatMoney(totals.subtotal)}
                  </dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <dt>Discount</dt>
                    <dd className="tabular-nums">
                      −{formatMoney(totals.discount)}
                    </dd>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <dt>Tax ({ro.taxRate.toFixed(2)}%)</dt>
                    <dd className="tabular-nums">{formatMoney(totals.tax)}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-zinc-200 text-base font-semibold text-zinc-900">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
                </div>
              </dl>
            </div>
          </section>

          {ro.payments.length > 0 && (
            <section className="px-8 py-4 border-b border-zinc-200">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                Payments received
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1">Date</th>
                    <th className="py-1">Method</th>
                    <th className="py-1">Reference</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ro.payments.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-100">
                      <td className="py-2 text-zinc-700">
                        {formatDate(p.paidAt)}
                      </td>
                      <td className="py-2 text-zinc-700">
                        {METHOD_LABEL[p.method] ?? p.method}
                      </td>
                      <td className="py-2 text-zinc-600">{p.reference ?? "—"}</td>
                      <td className="py-2 text-right text-zinc-900 tabular-nums">
                        {formatMoney(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {isInvoiced && (
            <section className="px-8 py-4">
              <div className="flex justify-end">
                <dl className="w-72 text-sm space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <dt>Paid</dt>
                    <dd className="tabular-nums">{formatMoney(paid)}</dd>
                  </div>
                  <div
                    className={
                      "flex justify-between pt-2 border-t border-zinc-200 text-base font-semibold " +
                      (balance <= 0 ? "text-green-700" : "text-amber-900")
                    }
                  >
                    <dt>{balance <= 0 ? "Paid in full" : "Balance due"}</dt>
                    <dd className="tabular-nums">{formatMoney(balance)}</dd>
                  </div>
                </dl>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
