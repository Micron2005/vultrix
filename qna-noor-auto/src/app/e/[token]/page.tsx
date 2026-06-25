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
import { approveEstimate, declineEstimate, approveJob, declineJob } from "../../repair-orders/share";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;
type Search = Promise<{ paid?: string; payerror?: string }>;

export default async function PublicEstimatePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Search;
}) {
  const { token } = await params;
  const sp = (await searchParams) ?? {};

  const ro = await db.repairOrder.findUnique({
    where: { shareToken: token },
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

  if (!ro) notFound();

  const shop = await getAllSettings(ro.orgId);
  const filtered = excludeDeclinedJobLines(ro);
  const preliminary = computeTotals({
    laborLines: filtered.laborLines,
    partLines: filtered.partLines,
    feeLines: filtered.feeLines,
    taxRate: ro.taxRate,
    discount: ro.discount,
  });
  const appliedShopFees = await loadAppliedShopFees(ro.orgId, ro.id, {
    partsSubtotal: preliminary.partsSubtotal,
    laborSubtotal: preliminary.laborSubtotal,
  });
  const totals = computeTotals({
    laborLines: filtered.laborLines,
    partLines: filtered.partLines,
    feeLines: filtered.feeLines,
    shopFees: appliedShopFees,
    taxRate: ro.taxRate,
    discount: ro.discount,
  });

  const approved = ro.approvedAt != null;
  const declined = ro.estimateDeclinedAt != null;
  const responded = approved || declined;

  const isInvoiced =
    ro.status === "INVOICED" ||
    ro.status === "PAID" ||
    ro.status === "COMPLETED";
  const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((totals.total - paid) * 100) / 100);
  const org = await db.organization.findUnique({
    where: { id: ro.orgId },
    select: { stripeConnectChargesEnabled: true },
  });
  const canPayOnline =
    isInvoiced && balance > 0 && Boolean(org?.stripeConnectChargesEnabled);

  const approve = approveEstimate.bind(null, token);
  const decline = declineEstimate.bind(null, token);

  return (
    <div className="min-h-screen bg-zinc-100 py-10">
      <div className="mx-auto max-w-3xl px-4">
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
                    {[shop.shopPhone, shop.shopEmail].filter(Boolean).join(" · ")}
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
              {ro.mileageIn != null && (
                <div className="text-zinc-600">
                  Mileage in: {ro.mileageIn.toLocaleString()}
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

          {ro.jobs.map((job) => {
            const jobLaborTotal = job.laborLines.reduce(
              (s: number, l: { hours: number; rate: number }) => s + l.hours * l.rate,
              0,
            );
            const jobPartsTotal = job.partLines.reduce(
              (s: number, p: { quantity: number; unitPrice: number }) =>
                s + p.quantity * p.unitPrice,
              0,
            );
            const jobFeesTotal = job.feeLines.reduce(
              (s: number, f: { amount: number }) => s + f.amount,
              0,
            );
            const jobTotal = jobLaborTotal + jobPartsTotal + jobFeesTotal;

            const jobApproved = job.approvalStatus === "APPROVED";
            const jobDeclined = job.approvalStatus === "DECLINED";
            const jobPending = job.approvalStatus === "PENDING";

            const boundApprove = approveJob.bind(null, token, job.id);
            const boundDecline = declineJob.bind(null, token, job.id);

            return (
              <section key={job.id} className="px-8 py-4 border-b border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {job.name}
                    </span>
                    {jobApproved && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                        Approved
                      </span>
                    )}
                    {jobDeclined && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Declined
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-zinc-700 tabular-nums">
                    {formatMoney(jobTotal)}
                  </span>
                </div>
                {job.notes && (
                  <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-600">
                    {job.notes}
                  </p>
                )}
                {job.laborLines.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Labor
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1 pr-2 font-medium">Description</th>
                          <th className="py-1 px-2 font-medium text-right">Hours</th>
                          <th className="py-1 px-2 font-medium text-right">Rate</th>
                          <th className="py-1 pl-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.laborLines.map((l) => (
                          <tr key={l.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-2 text-zinc-800">{l.description}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {l.hours.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatMoney(l.rate)}
                            </td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {formatMoney(l.hours * l.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {job.partLines.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Parts
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1 pr-2 font-medium">Description</th>
                          <th className="py-1 px-2 font-medium text-right">Qty</th>
                          <th className="py-1 px-2 font-medium text-right">Price</th>
                          <th className="py-1 pl-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.partLines.map((p) => (
                          <tr key={p.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-2 text-zinc-800">
                              {p.description}
                              {p.partNumber && (
                                <span className="ml-1 font-mono text-xs text-zinc-500">
                                  · {p.partNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {p.quantity}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatMoney(p.unitPrice)}
                            </td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {formatMoney(p.quantity * p.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {job.feeLines.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Fees
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1 pr-2 font-medium">Description</th>
                          <th className="py-1 pl-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.feeLines.map((f) => (
                          <tr key={f.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-2 text-zinc-800">{f.description}</td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {formatMoney(f.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {jobApproved && job.customerNote && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded text-xs text-emerald-800">
                    <span className="font-medium">Your note:</span>{" "}
                    {job.customerNote}
                  </div>
                )}
                {jobDeclined && job.customerNote && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-800">
                    <span className="font-medium">Your note:</span>{" "}
                    {job.customerNote}
                  </div>
                )}

                {jobPending && !responded && !isInvoiced && (
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <form action={boundApprove} className="space-y-2">
                      <textarea
                        name="customerNote"
                        rows={2}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Note for this job (optional)"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium"
                        >
                          Approve this job
                        </button>
                        <button
                          type="submit"
                          formAction={boundDecline}
                          className="rounded-md bg-white hover:bg-zinc-100 text-red-700 border border-red-300 px-3 py-1.5 text-xs font-medium"
                        >
                          Decline
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </section>
            );
          })}

          {/* Ungrouped lines (legacy data) */}
          {(() => {
            const uLabor = ro.laborLines.filter((l) => !l.jobId);
            const uParts = ro.partLines.filter((p) => !p.jobId);
            const uFees = ro.feeLines.filter((f) => !f.jobId);
            if (uLabor.length === 0 && uParts.length === 0 && uFees.length === 0) return null;
            return (
              <section className="px-8 py-4 border-b border-zinc-200">
                {ro.jobs.length > 0 && (
                  <div className="text-sm font-semibold text-zinc-900 mb-3">
                    Other Items
                  </div>
                )}
                {uLabor.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Labor
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1 pr-2 font-medium">Description</th>
                          <th className="py-1 px-2 font-medium text-right">Hours</th>
                          <th className="py-1 px-2 font-medium text-right">Rate</th>
                          <th className="py-1 pl-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uLabor.map((l) => (
                          <tr key={l.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-2 text-zinc-800">{l.description}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {l.hours.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatMoney(l.rate)}
                            </td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {formatMoney(l.hours * l.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {uParts.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Parts
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1 pr-2 font-medium">Description</th>
                          <th className="py-1 px-2 font-medium text-right">Qty</th>
                          <th className="py-1 px-2 font-medium text-right">Price</th>
                          <th className="py-1 pl-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uParts.map((p) => (
                          <tr key={p.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-2 text-zinc-800">
                              {p.description}
                              {p.partNumber && (
                                <span className="ml-1 font-mono text-xs text-zinc-500">
                                  · {p.partNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {p.quantity}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatMoney(p.unitPrice)}
                            </td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {formatMoney(p.quantity * p.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {uFees.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      Fees
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="py-1 pr-2 font-medium">Description</th>
                          <th className="py-1 pl-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uFees.map((f) => (
                          <tr key={f.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-2 text-zinc-800">{f.description}</td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {formatMoney(f.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })()}

          <section className="px-8 py-6 border-b border-zinc-200">
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              {appliedShopFees.map((f) => (
                <div key={f.id} className="flex justify-between">
                  <span className="text-zinc-600">{f.description || f.name}</span>
                  <span className="tabular-nums">{formatMoney(f.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-zinc-600">Subtotal</span>
                <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Discount</span>
                  <span className="tabular-nums">
                    −{formatMoney(totals.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-600">
                  Tax ({ro.taxRate.toFixed(2)}%)
                </span>
                <span className="tabular-nums">{formatMoney(totals.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 mt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(totals.total)}</span>
              </div>
              {isInvoiced && paid > 0 && (
                <>
                  <div className="flex justify-between text-zinc-600">
                    <span>Paid</span>
                    <span className="tabular-nums">{formatMoney(paid)}</span>
                  </div>
                  <div
                    className={
                      "flex justify-between border-t border-zinc-200 pt-2 mt-2 text-base font-semibold " +
                      (balance <= 0 ? "text-green-700" : "text-amber-900")
                    }
                  >
                    <span>{balance <= 0 ? "Paid in full" : "Balance due"}</span>
                    <span className="tabular-nums">{formatMoney(balance)}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {isInvoiced && (sp.paid || sp.payerror || canPayOnline) && (
            <section className="px-8 py-6 border-b border-zinc-200">
              {sp.paid && (
                <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  ✓ Thank you — your payment was received. It may take a moment
                  to update.
                </div>
              )}
              {sp.payerror && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  Sorry, we couldn&apos;t start the payment. Please try again or
                  contact the shop.
                </div>
              )}
              {canPayOnline && (
                <form
                  method="post"
                  action={`/api/pay/share/${token}`}
                  className="flex justify-end"
                >
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    Pay {formatMoney(balance)} online
                  </button>
                </form>
              )}
            </section>
          )}

          {approved && (
            <section className="px-8 py-6 bg-emerald-50 border-b border-emerald-200 text-sm">
              <div className="font-semibold text-emerald-900">
                ✓ Estimate approved
              </div>
              <div className="mt-1 text-emerald-800">
                Thanks — we received your approval on{" "}
                {formatDateTime(ro.approvedAt)}. We&rsquo;ll be in touch when your
                vehicle is ready.
              </div>
              {ro.customerResponseNote && (
                <div className="mt-3 text-emerald-900">
                  <div className="text-xs uppercase tracking-wider text-emerald-700 mb-1">
                    Your note
                  </div>
                  <div className="whitespace-pre-line">
                    {ro.customerResponseNote}
                  </div>
                </div>
              )}
            </section>
          )}

          {declined && (
            <section className="px-8 py-6 bg-red-50 border-b border-red-200 text-sm">
              <div className="font-semibold text-red-900">Estimate declined</div>
              <div className="mt-1 text-red-800">
                You declined this estimate on{" "}
                {formatDateTime(ro.estimateDeclinedAt)}. Give us a call if
                anything changes or if you have questions.
              </div>
              {ro.customerResponseNote && (
                <div className="mt-3 text-red-900">
                  <div className="text-xs uppercase tracking-wider text-red-700 mb-1">
                    Your note
                  </div>
                  <div className="whitespace-pre-line">
                    {ro.customerResponseNote}
                  </div>
                </div>
              )}
            </section>
          )}

          {!responded && !isInvoiced && (
            <section className="px-8 py-6 bg-zinc-50 text-sm">
              <div className="mb-3 text-zinc-700">
                You can approve or decline individual jobs above, or approve /
                decline the entire estimate below.
              </div>
              <form action={approve} className="space-y-3">
                <label className="block text-xs uppercase tracking-wider text-zinc-500">
                  Note (optional)
                </label>
                <textarea
                  name="customerResponseNote"
                  rows={3}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Any comments or questions?"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="flex-1 min-w-[12rem] rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-medium"
                  >
                    Approve entire estimate
                  </button>
                  <button
                    type="submit"
                    formAction={decline}
                    className="flex-1 min-w-[12rem] rounded-md bg-white hover:bg-zinc-100 text-red-700 border border-red-300 px-4 py-2.5 text-sm font-medium"
                  >
                    Decline entire estimate
                  </button>
                </div>
              </form>
            </section>
          )}

          <footer className="px-8 py-4 text-center text-xs text-zinc-500 bg-zinc-50 border-t border-zinc-200">
            Questions? Reply to the text/email you received this link in, or
            give the shop a call.
          </footer>
        </div>
      </div>
    </div>
  );
}
