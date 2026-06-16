import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
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
import { MileageInput } from "@/components/MileageInput";
import { SaveButton } from "@/components/SaveButton";
import { LifecycleActions, LifecycleTimeline } from "./LifecycleActions";
import { TechLineSelect } from "./TechLineSelect";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { ShareActions } from "./ShareActions";
import { getAllSettings } from "@/lib/shop";
import { ApplyPresetForm } from "./ApplyPresetForm";
import { applyCannedJobFormAction } from "@/app/canned-jobs/actions";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import {
  addFeeLine,
  addJob,
  addLaborLine,
  addPartLine,
  deleteFeeLine,
  deleteJob,
  deleteLaborLine,
  deletePartLine,
  deletePayment,
  deleteRepairOrder,
  recordPayment,
  updateFeeLine,
  updateJob,
  updateLaborLine,
  updateLaborLineTech,
  updatePartLine,
  updateRepairOrder,
  updateROVehicleInfo,
  approveJobAdmin,
  declineJobAdmin,
  resetJobApproval,
} from "../actions";
import { JobCard } from "./JobCard";
import {
  generateShareToken,
  regenerateShareToken,
  revokeShareToken,
} from "../share";
import { getSetting } from "@/lib/shop";
import {
  filterDuplicatesByLabor,
  openROsForVehicle,
  pastROsForVehicle,
} from "@/lib/duplicates";
import { DuplicateROBanner } from "@/components/DuplicateROBanner";
import { loadShopFeeStatus } from "@/lib/shopFees";
import {
  excludeShopFeeFromRO,
  readdShopFeeToRO,
} from "@/app/settings/shop-fees-actions";

export const dynamic = "force-dynamic";

export default async function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    include: {
      customer: true,
      vehicle: true,
      jobs: {
        orderBy: { sortOrder: "asc" },
        include: {
          laborLines: {
            orderBy: { sortOrder: "asc" },
            include: { technician: true },
          },
          partLines: { orderBy: { sortOrder: "asc" } },
          feeLines: { orderBy: { sortOrder: "asc" } },
        },
      },
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

  // Filter out lines from declined jobs before computing totals.
  const filtered = excludeDeclinedJobLines(ro);
  // First pass of totals without shop fees, to get labor/parts subtotals.
  const preliminary = computeTotals(filtered);
  const shopFeeStatus = await loadShopFeeStatus(orgId, ro.id, {
    partsSubtotal: preliminary.partsSubtotal,
    laborSubtotal: preliminary.laborSubtotal,
  });
  const appliedShopFees = shopFeeStatus
    .filter((f) => !f.excluded)
    .map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      amount: f.amount,
      taxable: f.taxable,
    }));
  const totals = computeTotals({ ...filtered, shopFees: appliedShopFees });
  const partsProfit = computePartsProfit(filtered.partLines);
  const paidTotal = ro.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.round((totals.total - paidTotal) * 100) / 100;
  const defaultLaborRate = await getSetting(orgId, "defaultLaborRate");

  const activeTechs = await db.technician.findMany({
    where: { active: true, orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, initials: true },
  });

  const catalogParts = await db.part.findMany({
    where: { archived: false, orgId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partNumber: true,
      qtyOnHand: true,
      unitPrice: true,
    },
  });

  const shopSettings = await getAllSettings(orgId);
  const shopName = shopSettings.shopName || "QNA / Noor Auto Repair";

  const presets = await db.cannedJob.findMany({
    where: { archived: false, orgId },
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

  // Once an RO has been billed or settled, its line items are locked. The
  // user can still flip the status back to IN_PROGRESS from the lifecycle
  // panel if they really need to edit, but by default edits are disabled so
  // the printed invoice always matches what's on file.
  const isLocked =
    ro.status === "INVOICED" || ro.status === "PAID" || ro.status === "CANCELLED";

  // Lines not assigned to any job (legacy or manually added without a job)
  const ungroupedLabor = ro.laborLines.filter((l) => !l.jobId);
  const ungroupedParts = ro.partLines.filter((p) => !p.jobId);
  const ungroupedFees = ro.feeLines.filter((f) => !f.jobId);

  const updateAction = updateRepairOrder.bind(null, ro.id);
  const addLabor = addLaborLine.bind(null, ro.id);
  const addPart = addPartLine.bind(null, ro.id);
  const addFee = addFeeLine.bind(null, ro.id);
  const addJobAction = addJob.bind(null, ro.id);
  const recordPay = recordPayment.bind(null, ro.id);
  const del = deleteRepairOrder.bind(null, ro.id);
  const genShare = generateShareToken.bind(null, ro.id);
  const regenShare = regenerateShareToken.bind(null, ro.id);
  const revokeShare = revokeShareToken.bind(null, ro.id);

  // Possible-duplicate detection: only flag other OPEN ROs on the same
  // vehicle whose labor lines share a significant word with this RO's
  // labor lines. Empty labor lines → no flag (handled by the filter).
  const otherOpen = await openROsForVehicle(orgId, ro.vehicleId, ro.id);
  const duplicates = filterDuplicatesByLabor(
    otherOpen,
    ro.laborLines.map((l) => l.description),
  );
  // Past (paid / invoiced / cancelled) tickets on this same vehicle, shown as
  // history so the shop can judge whether this RO duplicates earlier work.
  const pastTickets = await pastROsForVehicle(orgId, ro.vehicleId, ro.id);

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
          <div className="flex flex-wrap items-center gap-2">
            <LifecycleActions
              id={ro.id}
              status={ro.status}
              roNumber={ro.roNumber}
              cleared={ro.clearedAt != null}
            />
            {ro.shareToken && (
              <ShareActions
                token={ro.shareToken}
                customerEmail={ro.customer.email}
                customerPhone={ro.customer.phone}
                customerName={fullName(ro.customer)}
                roNumber={ro.roNumber}
                shopName={shopName}
                docLabel={
                  ro.status === "INVOICED" ||
                  ro.status === "PAID" ||
                  ro.status === "COMPLETED"
                    ? "Invoice"
                    : "Estimate"
                }
                compact
              />
            )}
          </div>
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

      {pastTickets.length > 0 && (
        <div className="mb-4">
          <DuplicateROBanner
            tone="info"
            ros={pastTickets}
            heading={`Past tickets for this vehicle (${pastTickets.length})`}
            subheading="Already paid, invoiced or cancelled. Check these so you don't duplicate work that was done before."
          />
        </div>
      )}

      <Card className="mb-4">
        <CardHeader title="Vehicle">
          <Link
            href={`/vehicles/${ro.vehicleId}`}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-normal underline"
          >
            Full vehicle record →
          </Link>
        </CardHeader>
        <form
          action={updateROVehicleInfo}
          className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <input type="hidden" name="repairOrderId" value={ro.id} />
          <input type="hidden" name="vehicleId" value={ro.vehicleId} />
          <div className="md:col-span-5">
            <Field label="VIN">
              <Input
                name="vin"
                defaultValue={ro.vehicle.vin ?? ""}
                placeholder="17-char VIN"
                maxLength={17}
                className="font-mono uppercase tracking-wider"
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="License plate">
              <Input
                name="licensePlate"
                defaultValue={ro.vehicle.licensePlate ?? ""}
                placeholder="tag #"
                className="uppercase"
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="State">
              <Input
                name="licenseState"
                defaultValue={ro.vehicle.licenseState ?? ""}
                placeholder="NJ"
                maxLength={2}
                className="uppercase"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Mileage (current)">
              <MileageInput
                name="mileage"
                defaultValue={ro.vehicle.mileage ?? null}
                placeholder="miles"
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Button type="submit" variant="secondary" className="w-full">
              Save
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <form id="ro-details-form" action={updateAction} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mileage in">
                <MileageInput
                  name="mileageIn"
                  defaultValue={ro.mileageIn ?? null}
                />
              </Field>
              <Field label="Mileage out">
                <MileageInput
                  name="mileageOut"
                  defaultValue={ro.mileageOut ?? null}
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
            {!isLocked && (
              <div className="flex items-center gap-3 pt-1">
                <SaveButton>Save details</SaveButton>
                <span className="text-xs text-zinc-500">
                  Saves the complaint, notes, tax rate &amp; discount above.
                </span>
              </div>
            )}
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
            {appliedShopFees.map((f) => (
              <Row
                key={f.id}
                label={f.description || f.name}
                value={formatMoney(f.amount)}
              />
            ))}
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
                        ({formatMarkup(partsProfit.markupPct)}
                        {partsProfit.marginPct != null &&
                          ` / ${formatMargin(partsProfit.marginPct)}`}
                        )
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

      {/* Card title & copy shift between "estimate" and "invoice" based on
          lifecycle stage — the underlying share token is the same. */}
      {(() => {
        const isInvoiceStage =
          ro.status === "INVOICED" ||
          ro.status === "PAID" ||
          ro.status === "COMPLETED";
        const docWord = isInvoiceStage ? "invoice" : "estimate";
        const DocWord = isInvoiceStage ? "Invoice" : "Estimate";
        return (
      <Card className="mb-4">
        <CardHeader title={`Shareable ${docWord} link`}>
          <span className="text-xs text-zinc-500 font-normal">
            Customer-safe — no cost, supplier, or internal data.
          </span>
        </CardHeader>
        <div className="p-4 space-y-3 text-sm">
          {ro.shareToken ? (
            <>
              <ShareLinkPanel token={ro.shareToken} />
              <ShareActions
                token={ro.shareToken}
                customerEmail={ro.customer.email}
                customerPhone={ro.customer.phone}
                customerName={fullName(ro.customer)}
                roNumber={ro.roNumber}
                shopName={shopName}
                docLabel={DocWord}
              />
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
                  {isInvoiceStage
                    ? "Use the buttons above to email, text, or print this invoice for the customer."
                    : "Waiting for customer response. Use the buttons above to email, text, or print the estimate."}
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
                {isInvoiceStage
                  ? `Generate a link to send this ${docWord} to your customer — they can view, print, or download it online, no login needed.`
                  : `Generate a link to send your customer. They can review the ${docWord} and approve or decline online — no login needed.`}
              </div>
              <form action={genShare}>
                <Button type="submit">Generate {docWord} link</Button>
              </form>
            </>
          )}
        </div>
      </Card>
        );
      })()}

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

      {/* Jobs section */}
      <Card className="mb-4">
        <CardHeader title={`Jobs (${ro.jobs.length})`}>
          <span className="text-xs text-zinc-500 font-normal">
            Each job groups its labor, parts, and fees together.
          </span>
        </CardHeader>
        {!isLocked && (
          <div className="p-4 border-b border-zinc-200 bg-zinc-50">
            <div className="flex items-end gap-3">
              <form action={addJobAction} className="flex items-end gap-2 flex-1">
                <div className="flex-1">
                  <Field label="Add a job">
                    <Input
                      name="name"
                      placeholder="e.g. Oil Change, Brake Service, A/C Repair"
                      required
                    />
                  </Field>
                </div>
                <Button type="submit" variant="secondary">
                  + Add job
                </Button>
              </form>
              {presetList.length > 0 && (
                <div className="flex-1">
                  <Field label="Or pick a preset">
                    <ApplyPresetForm action={applyPreset} presets={presetList} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {ro.jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          roId={ro.id}
          isLocked={isLocked}
          activeTechs={activeTechs}
          catalogParts={catalogParts}
          defaultLaborRate={defaultLaborRate}
          addLaborAction={addLabor}
          addPartAction={addPart}
          addFeeAction={addFee}
          updateLaborAction={updateLaborLine}
          updatePartAction={updatePartLine}
          updateFeeAction={updateFeeLine}
          deleteLaborAction={deleteLaborLine}
          deletePartAction={deletePartLine}
          deleteFeeAction={deleteFeeLine}
          updateJobAction={updateJob.bind(null, job.id, ro.id)}
          deleteJobAction={deleteJob.bind(null, job.id, ro.id)}
          approveJobAction={approveJobAdmin.bind(null, job.id, ro.id)}
          declineJobAction={declineJobAdmin.bind(null, job.id, ro.id)}
          resetApprovalAction={resetJobApproval.bind(null, job.id, ro.id)}
        />
      ))}

      {/* Ungrouped lines (legacy data not assigned to any job) */}
      {(ungroupedLabor.length > 0 || ungroupedParts.length > 0 || ungroupedFees.length > 0) && (
        <JobCard
          job={{
            id: "",
            name: "Ungrouped Items",
            laborLines: ungroupedLabor,
            partLines: ungroupedParts,
            feeLines: ungroupedFees,
          }}
          roId={ro.id}
          isLocked={isLocked}
          activeTechs={activeTechs}
          catalogParts={catalogParts}
          defaultLaborRate={defaultLaborRate}
          addLaborAction={addLabor}
          addPartAction={addPart}
          addFeeAction={addFee}
          updateLaborAction={updateLaborLine}
          updatePartAction={updatePartLine}
          updateFeeAction={updateFeeLine}
          deleteLaborAction={deleteLaborLine}
          deletePartAction={deletePartLine}
          deleteFeeAction={deleteFeeLine}
        />
      )}

      {shopFeeStatus.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title={`Shop fees (${shopFeeStatus.filter((f) => !f.excluded).length}/${shopFeeStatus.length})`}
          >
            <span className="text-xs text-zinc-500 font-normal">
              Auto-applied percentage fees. Remove any that don&apos;t apply to this job.
            </span>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Fee</th>
                <th className="px-4 py-2 font-medium">Formula</th>
                <th className="px-4 py-2 font-medium text-right w-32">Amount</th>
                <th className="px-4 py-2 font-medium text-right w-32">Status</th>
                <th className="px-2 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {shopFeeStatus.map((f) => {
                const formula = [
                  f.partsPercent > 0 ? `${f.partsPercent}% parts` : null,
                  f.laborPercent > 0 ? `${f.laborPercent}% labor` : null,
                ]
                  .filter(Boolean)
                  .join(" + ");
                const suffix = f.maxCap != null ? `, max ${formatMoney(f.maxCap)}` : "";
                const taxTag = f.taxable ? " · taxable" : "";
                return (
                  <tr key={f.id} className={f.excluded ? "opacity-50" : ""}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{f.name}</div>
                      {f.description && (
                        <div className="text-xs text-zinc-500">{f.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-600">
                      {(formula || "—") + suffix + taxTag}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {f.excluded ? (
                        <span className="text-zinc-400 line-through">
                          {formatMoney(f.amount)}
                        </span>
                      ) : (
                        formatMoney(f.amount)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {f.excluded ? (
                        <span className="text-xs text-zinc-500">excluded</span>
                      ) : (
                        <span className="text-xs text-green-700">applied</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {f.excluded ? (
                        <form action={readdShopFeeToRO.bind(null, ro.id, f.id)}>
                          <button
                            type="submit"
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Re-add
                          </button>
                        </form>
                      ) : (
                        <form action={excludeShopFeeFromRO.bind(null, ro.id, f.id)}>
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

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

      {/* Bottom action bar: Save + Save & Exit on the left, Delete on the
          right. All three buttons live outside the Details form and target
          it via the form="ro-details-form" attribute, so a click on Save
          submits the whole Details form. Save & Exit adds exit=1 which the
          server action uses to redirect back to the RO list. */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            form="ro-details-form"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Save
          </button>
          <button
            type="submit"
            form="ro-details-form"
            name="exit"
            value="1"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Save &amp; exit
          </button>
        </div>
        <form action={del}>
          <Button type="submit" variant="danger" size="sm">
            Delete RO
          </Button>
        </form>
      </div>
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

// Margin % = (price - cost) / price * 100. Complements markup — shops
// instinctively think in markup ("I mark parts up 40%") but financial
// reporting uses margin ("25% gross margin").
function calcMargin(
  cost: number | null | undefined,
  price: number | null | undefined,
): number | null {
  if (cost == null || !isFinite(cost)) return null;
  if (price == null || !isFinite(price) || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

function formatMarkup(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

function formatMargin(pct: number): string {
  const rounded = Math.round(pct);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded)}% margin`;
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
  marginPct: number | null;
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
  const marginPct =
    chargedForCostedLines > 0
      ? ((chargedForCostedLines - totalCost) / chargedForCostedLines) * 100
      : null;
  return {
    totalCost,
    totalCharged,
    profit,
    markupPct,
    marginPct,
    uncosted,
    hasAnyCost,
  };
}
