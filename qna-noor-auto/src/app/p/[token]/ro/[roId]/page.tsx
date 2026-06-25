import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/shop";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFees } from "@/lib/shopFees";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string; roId: string }>;
type Search = Promise<{ paid?: string; payerror?: string }>;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  CHECK: "Check",
  TRANSFER: "Transfer",
  OTHER: "Other",
};

export default async function CustomerPortalROPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Search;
}) {
  const { token, roId } = await params;
  const sp = (await searchParams) ?? {};

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
      jobs: {
        orderBy: { sortOrder: "asc" },
        include: {
          laborLines: { orderBy: { sortOrder: "asc" } },
          partLines: { orderBy: { sortOrder: "asc" } },
          feeLines: { orderBy: { sortOrder: "asc" } },
        },
      },
      laborLines: { orderBy: { sortOrder: "asc" } },
      partLines: { orderBy: { sortOrder: "asc" } },
      feeLines: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!ro || ro.customerId !== customer.id) notFound();

  const shop = await getAllSettings(ro.orgId);
  const filtered = excludeDeclinedJobLines(ro);
  const preliminary = computeTotals(filtered);
  const appliedShopFees = await loadAppliedShopFees(ro.orgId, ro.id, {
    partsSubtotal: preliminary.partsSubtotal,
    laborSubtotal: preliminary.laborSubtotal,
  });
  const totals = computeTotals({ ...filtered, shopFees: appliedShopFees });
  const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((totals.total - paid) * 100) / 100);

  const isInvoiced =
    ro.status === "INVOICED" ||
    ro.status === "PAID" ||
    ro.status === "COMPLETED";

  const org = await db.organization.findUnique({
    where: { id: ro.orgId },
    select: { stripeConnectChargesEnabled: true },
  });
  const canPayOnline =
    isInvoiced && balance > 0 && Boolean(org?.stripeConnectChargesEnabled);

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

          {ro.jobs.map((job) => (
            <section key={job.id} className="px-8 py-4 border-b border-zinc-200">
              <div className="text-sm font-semibold text-zinc-900 mb-3">{job.name}</div>
              {job.notes && (
                <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-600">
                  {job.notes}
                </p>
              )}
              {job.laborLines.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Labor</div>
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
                      {job.laborLines.map((l) => (
                        <tr key={l.id} className="border-t border-zinc-100">
                          <td className="py-2 text-zinc-800">{l.description}</td>
                          <td className="py-2 text-right text-zinc-700 tabular-nums">{l.hours.toFixed(1)}</td>
                          <td className="py-2 text-right text-zinc-700 tabular-nums">{formatMoney(l.rate)}</td>
                          <td className="py-2 text-right text-zinc-900 tabular-nums">{formatMoney(l.hours * l.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {job.partLines.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Parts</div>
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
                      {job.partLines.map((p) => (
                        <tr key={p.id} className="border-t border-zinc-100">
                          <td className="py-2 text-zinc-800">{p.description}</td>
                          <td className="py-2 text-right text-zinc-700 tabular-nums">{p.quantity}</td>
                          <td className="py-2 text-right text-zinc-700 tabular-nums">{formatMoney(p.unitPrice)}</td>
                          <td className="py-2 text-right text-zinc-900 tabular-nums">{formatMoney(p.quantity * p.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {job.feeLines.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fees</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500">
                        <th className="py-1">Description</th>
                        <th className="py-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.feeLines.map((f) => (
                        <tr key={f.id} className="border-t border-zinc-100">
                          <td className="py-2 text-zinc-800">{f.description}</td>
                          <td className="py-2 text-right text-zinc-900 tabular-nums">{formatMoney(f.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          {/* Ungrouped lines */}
          {(() => {
            const uL = ro.laborLines.filter((l) => !l.jobId);
            const uP = ro.partLines.filter((p) => !p.jobId);
            const uF = ro.feeLines.filter((f) => !f.jobId);
            if (!uL.length && !uP.length && !uF.length) return null;
            return (
              <section className="px-8 py-4 border-b border-zinc-200">
                {ro.jobs.length > 0 && (
                  <div className="text-sm font-semibold text-zinc-900 mb-3">Other Items</div>
                )}
                {uL.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Labor</div>
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
                        {uL.map((l) => (
                          <tr key={l.id} className="border-t border-zinc-100">
                            <td className="py-2 text-zinc-800">{l.description}</td>
                            <td className="py-2 text-right text-zinc-700 tabular-nums">{l.hours.toFixed(1)}</td>
                            <td className="py-2 text-right text-zinc-700 tabular-nums">{formatMoney(l.rate)}</td>
                            <td className="py-2 text-right text-zinc-900 tabular-nums">{formatMoney(l.hours * l.rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {uP.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Parts</div>
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
                        {uP.map((p) => (
                          <tr key={p.id} className="border-t border-zinc-100">
                            <td className="py-2 text-zinc-800">{p.description}</td>
                            <td className="py-2 text-right text-zinc-700 tabular-nums">{p.quantity}</td>
                            <td className="py-2 text-right text-zinc-700 tabular-nums">{formatMoney(p.unitPrice)}</td>
                            <td className="py-2 text-right text-zinc-900 tabular-nums">{formatMoney(p.quantity * p.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {uF.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fees</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1">Description</th>
                          <th className="py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uF.map((f) => (
                          <tr key={f.id} className="border-t border-zinc-100">
                            <td className="py-2 text-zinc-800">{f.description}</td>
                            <td className="py-2 text-right text-zinc-900 tabular-nums">{formatMoney(f.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })()}

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
                {totals.feesSubtotal > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <dt>Fees</dt>
                    <dd className="tabular-nums">
                      {formatMoney(totals.feesSubtotal)}
                    </dd>
                  </div>
                )}
                {appliedShopFees.map((f) => (
                  <div key={f.id} className="flex justify-between text-zinc-600">
                    <dt>{f.description || f.name}</dt>
                    <dd className="tabular-nums">{formatMoney(f.amount)}</dd>
                  </div>
                ))}
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
              {sp.paid && (
                <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  ✓ Thank you — your payment was received. It may take a moment
                  to show below.
                </div>
              )}
              {sp.payerror && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  Sorry, we couldn&apos;t start the payment. Please try again or
                  contact the shop.
                </div>
              )}
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
              {canPayOnline && (
                <div className="mt-4 flex justify-end">
                  <form method="post" action={`/api/pay/${token}/${roId}`}>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                      Pay {formatMoney(balance)} online
                    </button>
                  </form>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
