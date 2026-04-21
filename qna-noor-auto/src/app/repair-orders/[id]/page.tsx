import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { LifecycleActions, LifecycleTimeline } from "./LifecycleActions";
import { TechLineSelect } from "./TechLineSelect";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { ApplyPresetForm } from "./ApplyPresetForm";
import { applyCannedJobFormAction } from "@/app/canned-jobs/actions";
import { computeTotals } from "@/lib/totals";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import {
  addFeeLine,
  addLaborLine,
  addPartLine,
  deleteFeeLine,
  deleteLaborLine,
  deletePartLine,
  deletePayment,
  deleteRepairOrder,
  recordPayment,
  updateLaborLineTech,
  updateRepairOrder,
} from "../actions";
import {
  generateShareToken,
  regenerateShareToken,
  revokeShareToken,
} from "../share";
import { getSetting } from "@/lib/shop";
import {
  filterDuplicatesByLabor,
  openROsForVehicle,
} from "@/lib/duplicates";
import { DuplicateROBanner } from "@/components/DuplicateROBanner";

export const dynamic = "force-dynamic";

export default async function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      laborLines: {
        orderBy: { sortOrder: "asc" },
        include: { technician: true },
      },
      partLines: { orderBy: { sortOrder: "asc" } },
      feeLines: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!ro) notFound();

  const totals = computeTotals(ro);
  const partsProfit = computePartsProfit(ro.partLines);
  const paidTotal = ro.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.round((totals.total - paidTotal) * 100) / 100;
  const defaultLaborRate = await getSetting("defaultLaborRate");

  const activeTechs = await db.technician.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, initials: true },
  });

  const catalogParts = await db.part.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partNumber: true,
      qtyOnHand: true,
      unitPrice: true,
    },
  });

  const presets = await db.cannedJob.findMany({
    where: { archived: false },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      laborItems: { select: { id: true } },
      partItems: { select: { id: true } },
    },
  });
  const presetList = presets.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    laborCount: p.laborItems.length,
    partCount: p.partItems.length,
  }));
  const applyPreset = applyCannedJobFormAction.bind(null, ro.id);

  // Build "techs on this job" summary from labor lines.
  const techSummaryMap = new Map<
    string,
    { id: string; name: string; initials: string | null; hours: number }
  >();
  for (const l of ro.laborLines) {
    if (!l.technician) continue;
    const cur = techSummaryMap.get(l.technician.id);
    if (cur) cur.hours += l.hours;
    else
      techSummaryMap.set(l.technician.id, {
        id: l.technician.id,
        name: l.technician.name,
        initials: l.technician.initials,
        hours: l.hours,
      });
  }
  const techSummary = Array.from(techSummaryMap.values()).sort(
    (a, b) => b.hours - a.hours,
  );

  const updateAction = updateRepairOrder.bind(null, ro.id);
  const addLabor = addLaborLine.bind(null, ro.id);
  const addPart = addPartLine.bind(null, ro.id);
  const addFee = addFeeLine.bind(null, ro.id);
  const recordPay = recordPayment.bind(null, ro.id);
  const del = deleteRepairOrder.bind(null, ro.id);
  const genShare = generateShareToken.bind(null, ro.id);
  const regenShare = regenerateShareToken.bind(null, ro.id);
  const revokeShare = revokeShareToken.bind(null, ro.id);

  // Possible-duplicate detection: only flag other OPEN ROs on the same
  // vehicle whose labor lines share a significant word with this RO's
  // labor lines. Empty labor lines → no flag (handled by the filter).
  const otherOpen = await openROsForVehicle(ro.vehicleId, ro.id);
  const duplicates = filterDuplicatesByLabor(
    otherOpen,
    ro.laborLines.map((l) => l.description),
  );

  return (
    <>
      <PageHeader
        title={`RO #${ro.roNumber}`}
        description={
          <>
            <Link
              href={`/customers/${ro.customerId}`}
              className="underline"
            >
              {fullName(ro.customer)}
            </Link>
            {" · "}
            <Link href={`/vehicles/${ro.vehicleId}`} className="underline">
              {vehicleLabel(ro.vehicle)}
            </Link>
            {" · Opened "}
            {formatDate(ro.openedAt)}
          </>
        }
        actions={
          <LifecycleActions
            id={ro.id}
            status={ro.status}
            roNumber={ro.roNumber}
          />
        }
      />

      {duplicates.length > 0 && (
        <div className="mb-4">
          <DuplicateROBanner
            ros={duplicates}
            heading={`Possible duplicate — ${duplicates.length} other open RO${duplicates.length === 1 ? "" : "s"} on this vehicle share overlapping labor`}
            subheading="Review before invoicing. If this RO is truly a different job, you can ignore this notice."
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <form action={updateAction} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mileage in">
                <Input
                  name="mileageIn"
                  defaultValue={ro.mileageIn?.toString() ?? ""}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Mileage out">
                <Input
                  name="mileageOut"
                  defaultValue={ro.mileageOut?.toString() ?? ""}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field label="Complaint (what customer reported)">
              <Textarea
                name="complaint"
                rows={2}
                defaultValue={ro.complaint ?? ""}
              />
            </Field>
            <Field label="Cause (what you found)">
              <Textarea name="cause" rows={2} defaultValue={ro.cause ?? ""} />
            </Field>
            <Field label="Correction (what you did)">
              <Textarea
                name="correction"
                rows={2}
                defaultValue={ro.correction ?? ""}
              />
            </Field>
            <Field label="Internal notes">
              <Textarea name="notes" rows={2} defaultValue={ro.notes ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tax rate (%)">
                <Input
                  name="taxRate"
                  defaultValue={ro.taxRate.toString()}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Discount ($)">
                <Input
                  name="discount"
                  defaultValue={ro.discount.toString()}
                  inputMode="decimal"
                />
              </Field>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Totals" />
          <div className="p-4 text-sm space-y-2">
            <Row label="Labor" value={formatMoney(totals.laborSubtotal)} />
            <Row label="Parts" value={formatMoney(totals.partsSubtotal)} />
            {totals.feesSubtotal > 0 && (
              <Row label="Fees" value={formatMoney(totals.feesSubtotal)} />
            )}
            <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
            {totals.discount > 0 && (
              <Row
                label="Discount"
                value={`− ${formatMoney(totals.discount)}`}
              />
            )}
            <Row
              label={`Tax (${ro.taxRate}%)`}
              value={formatMoney(totals.tax)}
            />
            <div className="pt-2 border-t border-zinc-200">
              <Row
                label={<span className="font-semibold">Total</span>}
                value={
                  <span className="font-semibold text-lg">
                    {formatMoney(totals.total)}
                  </span>
                }
              />
            </div>
            {ro.payments.length > 0 && (
              <div className="pt-2 border-t border-zinc-200 space-y-2">
                <Row
                  label="Paid"
                  value={
                    <span className="text-green-700">
                      − {formatMoney(paidTotal)}
                    </span>
                  }
                />
                <Row
                  label={<span className="font-semibold">Balance</span>}
                  value={
                    <span
                      className={
                        "font-semibold text-lg " +
                        (balance <= 0
                          ? "text-green-700"
                          : "text-red-700")
                      }
                    >
                      {formatMoney(balance < 0 ? 0 : balance)}
                    </span>
                  }
                />
              </div>
            )}
          </div>
          {partsProfit.hasAnyCost && (
            <div className="border-t border-zinc-200 bg-zinc-50 p-4 text-sm space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                Parts profit (internal)
              </div>
              <Row
                label="Parts cost"
                value={
                  <span className="text-zinc-600">
                    {formatMoney(partsProfit.totalCost)}
                    {partsProfit.uncosted > 0 && (
                      <span className="text-xs text-amber-700 ml-1">
                        ({partsProfit.uncosted} w/o cost)
                      </span>
                    )}
                  </span>
                }
              />
              <Row
                label="Parts charged"
                value={formatMoney(partsProfit.totalCharged)}
              />
              <Row
                label="Profit"
                value={
                  <span className={markupClass(partsProfit.markupPct)}>
                    {formatMoney(partsProfit.profit)}
                    {partsProfit.markupPct != null && (
                      <span className="ml-2 text-xs">
                        ({formatMarkup(partsProfit.markupPct)})
                      </span>
                    )}
                  </span>
                }
              />
            </div>
          )}
          <div className="border-t border-zinc-200">
            <CardHeader title="Lifecycle" />
            <LifecycleTimeline ro={ro} />
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Shareable estimate link">
          <span className="text-xs text-zinc-500 font-normal">
            Customer-safe — no cost, supplier, or internal data.
          </span>
        </CardHeader>
        <div className="p-4 space-y-3 text-sm">
          {ro.shareToken ? (
            <>
              <ShareLinkPanel token={ro.shareToken} />
              {ro.approvedAt ? (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900">
                  <span className="font-medium">✓ Approved by customer</span>
                  {" — "}
                  {formatDateTime(ro.approvedAt)}
                  {ro.customerResponseNote && (
                    <div className="mt-1 text-xs text-emerald-800 whitespace-pre-line">
                      &ldquo;{ro.customerResponseNote}&rdquo;
                    </div>
                  )}
                </div>
              ) : ro.estimateDeclinedAt ? (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-red-900">
                  <span className="font-medium">Declined by customer</span>
                  {" — "}
                  {formatDateTime(ro.estimateDeclinedAt)}
                  {ro.customerResponseNote && (
                    <div className="mt-1 text-xs text-red-800 whitespace-pre-line">
                      &ldquo;{ro.customerResponseNote}&rdquo;
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-zinc-500">
                  Waiting for customer response. Paste the link above into a
                  text or email.
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {!ro.approvedAt && !ro.estimateDeclinedAt && (
                  <form action={regenShare}>
                    <Button type="submit" variant="secondary" size="sm">
                      Regenerate (invalidate old link)
                    </Button>
                  </form>
                )}
                <form action={revokeShare}>
                  <Button type="submit" variant="danger" size="sm">
                    Revoke link
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="text-zinc-600">
                Generate a link to send your customer. They can review the
                estimate and approve or decline online — no login needed.
              </div>
              <form action={genShare}>
                <Button type="submit">Generate share link</Button>
              </form>
            </>
          )}
        </div>
      </Card>

      {techSummary.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Techs on this job (${techSummary.length})`}>
            <span className="text-xs text-zinc-500 font-normal">
              Internal — not shown on customer invoice.
            </span>
          </CardHeader>
          <div className="p-4 flex flex-wrap gap-2">
            {techSummary.map((t) => (
              <Link
                key={t.id}
                href={`/technicians/${t.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm hover:bg-zinc-100"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-zinc-500">
                  {t.hours.toFixed(1)} hr{t.hours === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader title="Apply preset">
          <span className="text-xs text-zinc-500 font-normal">
            Drops all labor and parts from a canned job onto this RO.
          </span>
        </CardHeader>
        <div className="p-4">
          <ApplyPresetForm action={applyPreset} presets={presetList} />
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Labor (${ro.laborLines.length})`} />
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium w-40">Tech</th>
              <th className="px-4 py-2 font-medium text-right w-20">Hours</th>
              <th className="px-4 py-2 font-medium text-right w-28">Rate</th>
              <th className="px-4 py-2 font-medium text-right w-28">Amount</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {ro.laborLines.map((l) => {
              const delL = deleteLaborLine.bind(null, l.id, ro.id);
              return (
                <tr key={l.id}>
                  <td className="px-4 py-2">{l.description}</td>
                  <td className="px-4 py-2">
                    <TechLineSelect
                      laborLineId={l.id}
                      repairOrderId={ro.id}
                      currentId={l.technicianId}
                      currentName={l.technician?.name ?? null}
                      techs={activeTechs}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">{l.hours}</td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(l.rate)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(l.hours * l.rate)}
                  </td>
                  <td className="px-2 py-2">
                    <form action={delL}>
                      <button
                        type="submit"
                        className="text-zinc-400 hover:text-red-600 text-sm"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <form
          action={addLabor}
          className="p-3 border-t border-zinc-200 grid grid-cols-12 gap-2 items-end bg-zinc-50"
        >
          <div className="col-span-5">
            <Field label="Description">
              <Input name="description" placeholder="e.g. Replace brake pads (front)" required />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Tech">
              <Select name="technicianId" defaultValue="">
                <option value="">— Unassigned —</option>
                {activeTechs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="col-span-1">
            <Field label="Hours">
              <Input name="hours" inputMode="decimal" defaultValue="0" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Rate">
              <Input name="rate" inputMode="decimal" defaultValue={defaultLaborRate} />
            </Field>
          </div>
          <div className="col-span-2">
            <Button type="submit" className="w-full" variant="secondary">
              + Add labor
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Parts (${ro.partLines.length})`}>
          <span className="text-xs text-zinc-500 font-normal">
            Cost &amp; source are internal — not shown on customer invoice.
          </span>
        </CardHeader>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium w-28">Part #</th>
              <th className="px-4 py-2 font-medium w-32">Source</th>
              <th className="px-4 py-2 font-medium text-right w-16">Qty</th>
              <th className="px-4 py-2 font-medium text-right w-24">Cost</th>
              <th className="px-4 py-2 font-medium text-right w-24">Price</th>
              <th className="px-4 py-2 font-medium text-right w-20">Markup</th>
              <th className="px-4 py-2 font-medium text-right w-24">Amount</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {ro.partLines.map((p) => {
              const delP = deletePartLine.bind(null, p.id, ro.id);
              const markup = calcMarkup(p.costPrice, p.unitPrice);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2">{p.description}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {p.partNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">
                    {p.source ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{p.quantity}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {p.costPrice != null ? formatMoney(p.costPrice) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(p.unitPrice)}
                  </td>
                  <td
                    className={
                      "px-4 py-2 text-right text-xs font-medium " +
                      markupClass(markup)
                    }
                  >
                    {markup == null ? "—" : formatMarkup(markup)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(p.quantity * p.unitPrice)}
                  </td>
                  <td className="px-2 py-2">
                    <form action={delP}>
                      <button
                        type="submit"
                        className="text-zinc-400 hover:text-red-600 text-sm"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <form
          action={addPart}
          className="p-3 border-t border-zinc-200 grid grid-cols-12 gap-2 items-end bg-zinc-50"
        >
          {catalogParts.length > 0 && (
            <div className="col-span-12">
              <Field label="Inventory (optional — auto-fills and deducts stock)">
                <Select name="partId" defaultValue="">
                  <option value="">— Free-text part (not from inventory) —</option>
                  {catalogParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.partNumber ? ` · ${p.partNumber}` : ""}
                      {` · ${p.qtyOnHand} on hand`}
                      {p.unitPrice != null ? ` · $${p.unitPrice.toFixed(2)}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <div className="col-span-4">
            <Field label="Description">
              <Input
                name="description"
                placeholder="e.g. Brake pad set, front — or pick from inventory above"
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Part #">
              <Input name="partNumber" />
            </Field>
          </div>
          <div className="col-span-3">
            <Field label="Source (where you got it)">
              <Input name="source" placeholder="e.g. NAPA, AutoZone, dealer" />
            </Field>
          </div>
          <div className="col-span-1">
            <Field label="Qty">
              <Input name="quantity" inputMode="decimal" defaultValue="1" />
            </Field>
          </div>
          <div className="col-span-1">
            <Field label="Cost">
              <Input
                name="costPrice"
                inputMode="decimal"
                placeholder="you paid"
              />
            </Field>
          </div>
          <div className="col-span-1">
            <Field label="Price">
              <Input
                name="unitPrice"
                inputMode="decimal"
                defaultValue="0"
                title="What you charge the customer per unit"
              />
            </Field>
          </div>
          <div className="col-span-12">
            <Button type="submit" variant="secondary">
              + Add part
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Fees (${ro.feeLines.length})`}>
          <span className="text-xs text-zinc-500 font-normal">
            Flat-amount charges (state inspection, shop supplies, diagnostic fee, etc).
          </span>
        </CardHeader>
        {ro.feeLines.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right w-32">Amount</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {ro.feeLines.map((f) => {
                const delF = deleteFeeLine.bind(null, f.id, ro.id);
                return (
                  <tr key={f.id}>
                    <td className="px-4 py-2">{f.description}</td>
                    <td className="px-4 py-2 text-right">
                      {formatMoney(f.amount)}
                    </td>
                    <td className="px-2 py-2">
                      <form action={delF}>
                        <button
                          type="submit"
                          className="text-zinc-400 hover:text-red-600 text-sm"
                          aria-label="Delete"
                        >
                          ×
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <form
          action={addFee}
          className="p-3 border-t border-zinc-200 grid grid-cols-12 gap-2 items-end bg-zinc-50"
        >
          <div className="col-span-8">
            <Field label="Description">
              <Input
                name="description"
                placeholder="e.g. State inspection, shop supplies, diagnostic fee"
                required
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Amount ($)">
              <Input
                name="amount"
                inputMode="decimal"
                defaultValue="0"
                required
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Button type="submit" className="w-full" variant="secondary">
              + Add fee
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Payments (${ro.payments.length})`}>
          <span className="text-xs text-zinc-500 font-normal">
            {balance > 0
              ? `Balance due: ${formatMoney(balance)}`
              : ro.payments.length > 0
                ? "Paid in full"
                : "No payments recorded"}
          </span>
        </CardHeader>
        {ro.payments.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium w-28">Date</th>
                <th className="px-4 py-2 font-medium w-24">Method</th>
                <th className="px-4 py-2 font-medium w-32">Reference</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 font-medium text-right w-28">Amount</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {ro.payments.map((p) => {
                const delPay = deletePayment.bind(null, p.id, ro.id);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-zinc-600">
                      {formatDate(p.paidAt)}
                    </td>
                    <td className="px-4 py-2">{prettyPaymentMethod(p.method)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{p.note ?? ""}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="px-2 py-2">
                      <form action={delPay}>
                        <button
                          type="submit"
                          className="text-zinc-400 hover:text-red-600 text-sm"
                          aria-label="Delete payment"
                        >
                          ×
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {balance > 0 && (
          <form
            action={recordPay}
            className="p-3 border-t border-zinc-200 grid grid-cols-12 gap-2 items-end bg-zinc-50"
          >
            <div className="col-span-2">
              <Field label="Amount">
                <Input
                  name="amount"
                  inputMode="decimal"
                  defaultValue={balance.toFixed(2)}
                  required
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Method">
                <Select name="method" defaultValue="CASH">
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="CHECK">Check</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Date">
                <Input
                  name="paidAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Reference">
                <Input name="reference" placeholder="check # / last 4" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Note">
                <Input name="note" placeholder="optional" />
              </Field>
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full">
                Record payment
              </Button>
            </div>
          </form>
        )}
      </Card>

      <form action={del} className="mt-10">
        <Button type="submit" variant="danger" size="sm">
          Delete RO
        </Button>
      </form>
    </>
  );
}

function prettyPaymentMethod(m: string): string {
  switch (m) {
    case "CASH":
      return "Cash";
    case "CARD":
      return "Card";
    case "CHECK":
      return "Check";
    case "TRANSFER":
      return "Transfer";
    case "OTHER":
      return "Other";
    default:
      return m;
  }
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Markup % = (price - cost) / cost * 100.
// Returns null if cost is unknown or zero so we can't compute a meaningful %.
function calcMarkup(
  cost: number | null | undefined,
  price: number | null | undefined,
): number | null {
  if (cost == null || !isFinite(cost) || cost <= 0) return null;
  if (price == null || !isFinite(price)) return null;
  return ((price - cost) / cost) * 100;
}

function formatMarkup(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

function markupClass(pct: number | null): string {
  if (pct == null) return "text-zinc-400";
  if (pct > 0) return "text-green-700";
  if (pct < 0) return "text-red-700";
  return "text-zinc-600";
}

// Aggregate parts profitability across the RO. Lines without a cost are
// excluded from the cost total but flagged so the mechanic sees they weren't
// captured yet.
function computePartsProfit(
  lines: {
    quantity: number;
    unitPrice: number;
    costPrice: number | null;
  }[],
): {
  totalCost: number;
  totalCharged: number;
  profit: number;
  markupPct: number | null;
  uncosted: number;
  hasAnyCost: boolean;
} {
  let totalCost = 0;
  let chargedForCostedLines = 0;
  let totalCharged = 0;
  let uncosted = 0;
  let hasAnyCost = false;
  for (const l of lines) {
    const qty = l.quantity ?? 0;
    const charge = qty * (l.unitPrice ?? 0);
    totalCharged += charge;
    if (l.costPrice != null && isFinite(l.costPrice)) {
      hasAnyCost = true;
      totalCost += qty * l.costPrice;
      chargedForCostedLines += charge;
    } else {
      uncosted += 1;
    }
  }
  const profit = chargedForCostedLines - totalCost;
  const markupPct =
    totalCost > 0 ? ((chargedForCostedLines - totalCost) / totalCost) * 100 : null;
  return {
    totalCost,
    totalCharged,
    profit,
    markupPct,
    uncosted,
    hasAnyCost,
  };
}
