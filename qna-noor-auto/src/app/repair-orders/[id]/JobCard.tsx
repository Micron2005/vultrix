"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { TechLineSelect } from "./TechLineSelect";
import { SaveButton } from "@/components/SaveButton";
import { formatMoney } from "@/lib/utils";

type LaborLineData = {
  id: string;
  description: string;
  hours: number;
  rate: number;
  technicianId: string | null;
  technician: { id: string; name: string; initials: string | null } | null;
};

type PartLineData = {
  id: string;
  description: string;
  partNumber: string | null;
  source: string | null;
  quantity: number;
  unitPrice: number;
  costPrice: number | null;
};

type FeeLineData = {
  id: string;
  description: string;
  amount: number;
};

type Tech = { id: string; name: string; initials: string | null };
type CatalogPart = {
  id: string;
  name: string;
  partNumber: string | null;
  qtyOnHand: number;
  unitPrice: number | null;
};

export function JobCard({
  job,
  roId,
  isLocked,
  activeTechs,
  catalogParts,
  defaultLaborRate,
  addLaborAction,
  addPartAction,
  addFeeAction,
  updateLaborAction,
  updatePartAction,
  updateFeeAction,
  deleteLaborAction,
  deletePartAction,
  deleteFeeAction,
  updateJobAction,
  deleteJobAction,
  approveJobAction,
  declineJobAction,
  resetApprovalAction,
}: {
  job: {
    id: string;
    name: string;
    notes?: string | null;
    approvalStatus?: string;
    laborLines: LaborLineData[];
    partLines: PartLineData[];
    feeLines: FeeLineData[];
  };
  roId: string;
  isLocked: boolean;
  activeTechs: Tech[];
  catalogParts: CatalogPart[];
  defaultLaborRate: string;
  addLaborAction: (fd: FormData) => void;
  addPartAction: (fd: FormData) => void;
  addFeeAction: (fd: FormData) => void;
  updateLaborAction: (id: string, roId: string, fd: FormData) => void;
  updatePartAction: (id: string, roId: string, fd: FormData) => void;
  updateFeeAction: (id: string, roId: string, fd: FormData) => void;
  deleteLaborAction: (id: string, roId: string) => void;
  deletePartAction: (id: string, roId: string) => void;
  deleteFeeAction: (id: string, roId: string) => void;
  updateJobAction?: (fd: FormData) => void;
  deleteJobAction?: () => void;
  approveJobAction?: () => void;
  declineJobAction?: () => void;
  resetApprovalAction?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingType, setAddingType] = useState<
    "labor" | "parts" | "fees" | null
  >(null);
  const [editingName, setEditingName] = useState(false);

  const laborTotal = job.laborLines.reduce(
    (s, l) => s + l.hours * l.rate,
    0,
  );
  const partsTotal = job.partLines.reduce(
    (s, p) => s + p.quantity * p.unitPrice,
    0,
  );
  const partsCost = job.partLines.reduce(
    (s, p) => s + p.quantity * (p.costPrice ?? p.unitPrice),
    0,
  );
  const feesTotal = job.feeLines.reduce((s, f) => s + f.amount, 0);
  const jobTotal = laborTotal + partsTotal + feesTotal;

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-400 hover:text-zinc-600 text-sm font-mono w-5"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▼" : "▶"}
          </button>
          {editingName && updateJobAction ? (
            <form
              action={(fd) => {
                updateJobAction(fd);
                setEditingName(false);
              }}
              className="flex items-center gap-2"
            >
              <Input
                name="name"
                defaultValue={job.name}
                className="w-64"
                autoFocus
              />
              <Button type="submit" size="sm" variant="secondary">
                Save
              </Button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="text-xs text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                onClick={() => !isLocked && updateJobAction && setEditingName(true)}
                className="text-sm font-semibold text-zinc-900 hover:text-zinc-600"
                title={isLocked || !updateJobAction ? undefined : "Click to rename"}
              >
                {job.name}
              </button>
              {job.approvalStatus === "APPROVED" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  Approved
                </span>
              )}
              {job.approvalStatus === "DECLINED" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                  Declined
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLocked && approveJobAction && job.approvalStatus === "PENDING" && (
            <>
              <form action={approveJobAction} className="inline">
                <button
                  type="submit"
                  className="rounded px-2 py-0.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve
                </button>
              </form>
              <form action={declineJobAction} className="inline">
                <button
                  type="submit"
                  className="rounded px-2 py-0.5 text-xs font-medium bg-white hover:bg-zinc-100 text-red-700 border border-red-300"
                >
                  Decline
                </button>
              </form>
            </>
          )}
          {!isLocked && resetApprovalAction && job.approvalStatus !== "PENDING" && (
            <form action={resetApprovalAction} className="inline">
              <button
                type="submit"
                className="rounded px-2 py-0.5 text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-300"
                title="Reset to pending"
              >
                Reset
              </button>
            </form>
          )}
          <span className="text-sm font-medium text-zinc-700 tabular-nums">
            {formatMoney(jobTotal)}
          </span>
          {!isLocked && deleteJobAction && (
            <form action={deleteJobAction}>
              <button
                type="submit"
                className="text-zinc-400 hover:text-red-600 text-sm"
                aria-label="Delete job"
                title="Delete job and all its line items"
              >
                ×
              </button>
            </form>
          )}
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-zinc-100">
          {/* Job notes (internal — not shown to the customer) */}
          {job.id && updateJobAction && !isLocked ? (
            <div className="px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">
                Job notes
              </div>
              <form action={updateJobAction} className="space-y-2">
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={job.notes ?? ""}
                  placeholder="Notes for this job (internal — not shown to the customer)"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
                <SaveButton>Save notes</SaveButton>
              </form>
            </div>
          ) : (
            job.notes && (
              <div className="px-4 py-2">
                <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  Job notes
                </div>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                  {job.notes}
                </p>
              </div>
            )
          )}
          {/* Labor lines */}
          {job.laborLines.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">
                Labor
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 font-medium w-32">Tech</th>
                    <th className="py-1 font-medium text-right w-16">Hours</th>
                    <th className="py-1 font-medium text-right w-24">Rate</th>
                    <th className="py-1 font-medium text-right w-24">Amount</th>
                    <th className="py-1 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {job.laborLines.map((l) => {
                    const updL = updateLaborAction.bind(null, l.id, roId);
                    const delL = deleteLaborAction.bind(null, l.id, roId);
                    if (isLocked) {
                      return (
                        <tr key={l.id}>
                          <td className="py-1.5">{l.description}</td>
                          <td className="py-1.5 text-zinc-600 text-xs">
                            {l.technician?.name ?? "—"}
                          </td>
                          <td className="py-1.5 text-right">{l.hours}</td>
                          <td className="py-1.5 text-right">{formatMoney(l.rate)}</td>
                          <td className="py-1.5 text-right">
                            {formatMoney(l.hours * l.rate)}
                          </td>
                          <td></td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={l.id}>
                        <td className="py-1">
                          <form
                            id={`labor-${l.id}`}
                            action={updL}
                            className="contents"
                          />
                          <Input
                            form={`labor-${l.id}`}
                            name="description"
                            defaultValue={l.description}
                            className="w-full"
                          />
                        </td>
                        <td className="py-1 px-1">
                          <TechLineSelect
                            laborLineId={l.id}
                            repairOrderId={roId}
                            currentId={l.technicianId}
                            currentName={l.technician?.name ?? null}
                            techs={activeTechs}
                          />
                        </td>
                        <td className="py-1 text-right">
                          <Input
                            form={`labor-${l.id}`}
                            name="hours"
                            inputMode="decimal"
                            defaultValue={String(l.hours)}
                            className="w-16 text-right"
                          />
                        </td>
                        <td className="py-1 text-right">
                          <Input
                            form={`labor-${l.id}`}
                            name="rate"
                            inputMode="decimal"
                            defaultValue={String(l.rate)}
                            className="w-20 text-right"
                          />
                        </td>
                        <td className="py-1 text-right text-zinc-700">
                          {formatMoney(l.hours * l.rate)}
                        </td>
                        <td className="py-1 whitespace-nowrap text-right">
                          <button
                            type="submit"
                            form={`labor-${l.id}`}
                            className="mr-1 h-6 px-1.5 rounded text-xs font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
                          >
                            Save
                          </button>
                          <form action={delL} className="inline">
                            <button
                              type="submit"
                              className="text-zinc-400 hover:text-red-600 text-sm"
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
            </div>
          )}

          {/* Part lines */}
          {job.partLines.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">
                Parts
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 font-medium w-20">Part #</th>
                    <th className="py-1 font-medium text-right w-12">Qty</th>
                    <th className="py-1 font-medium text-right w-20">Cost</th>
                    <th className="py-1 font-medium text-right w-20">List Price</th>
                    <th className="py-1 font-medium text-right w-24">Amount</th>
                    <th className="py-1 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {job.partLines.map((p) => {
                    const updP = updatePartAction.bind(null, p.id, roId);
                    const delP = deletePartAction.bind(null, p.id, roId);
                    if (isLocked) {
                      return (
                        <tr key={p.id}>
                          <td className="py-1.5">{p.description}</td>
                          <td className="py-1.5 font-mono text-xs text-zinc-600">
                            {p.partNumber ?? "—"}
                          </td>
                          <td className="py-1.5 text-right">{p.quantity}</td>
                          <td className="py-1.5 text-right text-zinc-500">
                            {p.costPrice != null ? formatMoney(p.costPrice) : "—"}
                          </td>
                          <td className="py-1.5 text-right">
                            {formatMoney(p.unitPrice)}
                          </td>
                          <td className="py-1.5 text-right">
                            {formatMoney(p.quantity * p.unitPrice)}
                          </td>
                          <td></td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={p.id}>
                        <td className="py-1">
                          <form
                            id={`part-${p.id}`}
                            action={updP}
                            className="contents"
                          />
                          <Input
                            form={`part-${p.id}`}
                            name="description"
                            defaultValue={p.description}
                            className="w-full"
                          />
                        </td>
                        <td className="py-1 font-mono text-xs text-zinc-600">
                          {p.partNumber ?? "—"}
                        </td>
                        <td className="py-1 text-right">
                          <Input
                            form={`part-${p.id}`}
                            name="quantity"
                            inputMode="decimal"
                            defaultValue={String(p.quantity)}
                            className="w-12 text-right"
                          />
                        </td>
                        <td className="py-1 text-right">
                          <Input
                            form={`part-${p.id}`}
                            name="costPrice"
                            inputMode="decimal"
                            defaultValue={p.costPrice != null ? String(p.costPrice) : ""}
                            placeholder="—"
                            className="w-20 text-right"
                          />
                        </td>
                        <td className="py-1 text-right">
                          <Input
                            form={`part-${p.id}`}
                            name="unitPrice"
                            inputMode="decimal"
                            defaultValue={String(p.unitPrice)}
                            className="w-20 text-right"
                          />
                        </td>
                        <td className="py-1 text-right text-zinc-700">
                          {formatMoney(p.quantity * p.unitPrice)}
                        </td>
                        <td className="py-1 whitespace-nowrap text-right">
                          <button
                            type="submit"
                            form={`part-${p.id}`}
                            className="mr-1 h-6 px-1.5 rounded text-xs font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
                          >
                            Save
                          </button>
                          <form action={delP} className="inline">
                            <button
                              type="submit"
                              className="text-zinc-400 hover:text-red-600 text-sm"
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
            </div>
          )}

          {/* Fee lines */}
          {job.feeLines.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">
                Fees
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 font-medium text-right w-24">Amount</th>
                    <th className="py-1 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {job.feeLines.map((f) => {
                    const updF = updateFeeAction.bind(null, f.id, roId);
                    const delF = deleteFeeAction.bind(null, f.id, roId);
                    if (isLocked) {
                      return (
                        <tr key={f.id}>
                          <td className="py-1.5">{f.description}</td>
                          <td className="py-1.5 text-right">
                            {formatMoney(f.amount)}
                          </td>
                          <td></td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={f.id}>
                        <td className="py-1">
                          <form
                            id={`fee-${f.id}`}
                            action={updF}
                            className="contents"
                          />
                          <Input
                            form={`fee-${f.id}`}
                            name="description"
                            defaultValue={f.description}
                            className="w-full"
                          />
                        </td>
                        <td className="py-1 text-right">
                          <Input
                            form={`fee-${f.id}`}
                            name="amount"
                            inputMode="decimal"
                            defaultValue={String(f.amount)}
                            className="w-20 text-right"
                          />
                        </td>
                        <td className="py-1 whitespace-nowrap text-right">
                          <button
                            type="submit"
                            form={`fee-${f.id}`}
                            className="mr-1 h-6 px-1.5 rounded text-xs font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
                          >
                            Save
                          </button>
                          <form action={delF} className="inline">
                            <button
                              type="submit"
                              className="text-zinc-400 hover:text-red-600 text-sm"
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
            </div>
          )}

          {/* Add line item dropdown */}
          {!isLocked && (
            <div className="px-4 py-3">
              {addingType === null ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Add:</span>
                  <button
                    onClick={() => setAddingType("labor")}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                  >
                    + Labor
                  </button>
                  <button
                    onClick={() => setAddingType("parts")}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                  >
                    + Parts
                  </button>
                  <button
                    onClick={() => setAddingType("fees")}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                  >
                    + Fee
                  </button>
                </div>
              ) : addingType === "labor" ? (
                <form
                  action={(fd) => {
                    fd.set("jobId", job.id);
                    addLaborAction(fd);
                    setAddingType(null);
                  }}
                  className="space-y-2"
                >
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                    Add Labor
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Field label="Description">
                        <Input
                          name="description"
                          placeholder="e.g. Replace brake pads"
                          required
                          autoFocus
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Tech">
                        <Select name="technicianId" defaultValue="">
                          <option value="">— None —</option>
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
                        <Input
                          name="hours"
                          inputMode="decimal"
                          defaultValue="0"
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Rate">
                        <Input
                          name="rate"
                          inputMode="decimal"
                          defaultValue={defaultLaborRate}
                        />
                      </Field>
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <Button type="submit" variant="secondary" size="sm">
                        Add
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAddingType(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : addingType === "parts" ? (
                <form
                  action={(fd) => {
                    fd.set("jobId", job.id);
                    addPartAction(fd);
                    setAddingType(null);
                  }}
                  className="space-y-2"
                >
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                    Add Part
                  </div>
                  {catalogParts.length > 0 && (
                    <Field label="From inventory (optional)">
                      <Select name="partId" defaultValue="">
                        <option value="">— Free-text part —</option>
                        {catalogParts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.partNumber ? ` · ${p.partNumber}` : ""}
                            {` · ${p.qtyOnHand} on hand`}
                            {p.unitPrice != null
                              ? ` · $${p.unitPrice.toFixed(2)}`
                              : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <Field label="Description">
                        <Input
                          name="description"
                          placeholder="e.g. Brake pad set"
                          autoFocus
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Part #">
                        <Input name="partNumber" />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Source">
                        <Input name="source" placeholder="NAPA, etc." />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="Qty">
                        <Input
                          name="quantity"
                          inputMode="decimal"
                          defaultValue="1"
                        />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="Cost">
                        <Input
                          name="costPrice"
                          inputMode="decimal"
                          placeholder="—"
                        />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="List Price">
                        <Input
                          name="unitPrice"
                          inputMode="decimal"
                          defaultValue="0"
                        />
                      </Field>
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <Button type="submit" variant="secondary" size="sm">
                        Add
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAddingType(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <form
                  action={(fd) => {
                    fd.set("jobId", job.id);
                    addFeeAction(fd);
                    setAddingType(null);
                  }}
                  className="space-y-2"
                >
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                    Add Fee
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7">
                      <Field label="Description">
                        <Input
                          name="description"
                          placeholder="e.g. Diagnostic fee"
                          required
                          autoFocus
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
                    <div className="col-span-3 flex gap-1">
                      <Button type="submit" variant="secondary" size="sm">
                        Add
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAddingType(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
          {isLocked && (
            <div className="px-4 py-2 text-xs text-zinc-500 bg-zinc-50">
              Line items are locked because this RO is{" "}
              <strong>{isLocked ? "locked" : ""}</strong>.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
