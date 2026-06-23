"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Button, Select, StatusBadge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import {
  bulkDeleteRepairOrders,
  clearSelectedRepairOrders,
  paySelectedRepairOrders,
  removeBulkSelectionPayments,
} from "../actions";

export type ROItem = {
  roId: string;
  roNumber: number;
  vehicle: string;
  status: string;
  openedAt: string;
  total: number;
  paid: number;
  balance: number;
  cleared: boolean;
  clearedAt: string | null;
};

type Section = {
  key: string;
  title: string;
  items: ROItem[];
  showBalance?: boolean;
  showCleared?: boolean;
  defaultCollapsed?: boolean;
};

export function SelectableROList({
  customerId,
  sections,
}: {
  customerId: string;
  sections: Section[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.defaultCollapsed).map((s) => s.key)),
  );
  const [method, setMethod] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRemoveDup, setConfirmingRemoveDup] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const allItems = sections.flatMap((s) => s.items);
  const selectedItems = allItems.filter((i) => selected.has(i.roId));
  const selectedBalance = selectedItems.reduce((s, i) => s + i.balance, 0);
  const selectedPayable = selectedItems.filter(
    (i) => i.balance > 0 && i.status !== "CANCELLED" && i.status !== "PAID",
  );
  const selectedClearable = selectedItems.filter(
    (i) => i.status === "PAID" && !i.cleared,
  );
  const selectedPaid = selectedItems.filter((i) => i.status === "PAID");

  function toggle(roId: string) {
    setResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roId)) next.delete(roId);
      else next.add(roId);
      return next;
    });
  }

  function toggleSection(items: ROItem[], allChecked: boolean) {
    setResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) {
        if (allChecked) next.delete(i.roId);
        else next.add(i.roId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmingDelete(false);
    setConfirmingRemoveDup(false);
    setResult(null);
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handlePay() {
    if (selectedPayable.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await paySelectedRepairOrders(
        customerId,
        selectedPayable.map((i) => i.roId),
        method,
      );
      setResult(res);
      if (res.ok) setSelected(new Set());
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (selectedClearable.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await clearSelectedRepairOrders(
        customerId,
        selectedClearable.map((i) => i.roId),
      );
      setResult(res);
      if (res.ok) setSelected(new Set());
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDup() {
    if (selectedPaid.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await removeBulkSelectionPayments(
        customerId,
        selectedPaid.map((i) => i.roId),
      );
      setResult(res);
      if (res.ok) setSelected(new Set());
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
      setConfirmingRemoveDup(false);
    }
  }

  async function handleDelete() {
    if (selectedItems.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await bulkDeleteRepairOrders(
        customerId,
        selectedItems.map((i) => i.roId),
      );
      setResult(res);
      if (res.ok) setSelected(new Set());
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div>
      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-4 rounded-lg border border-zinc-300 bg-white shadow-md p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-zinc-900">
              {selected.size} selected
              {selectedBalance > 0 && (
                <span className="text-zinc-500 font-normal">
                  {" "}· {formatMoney(selectedBalance)} owed
                </span>
              )}
            </span>

            <div className="flex-1" />

            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-700 font-medium">
                  Delete {selected.size} ticket{selected.size !== 1 ? "s" : ""} permanently? This cannot be undone.
                </span>
                <Button variant="danger" onClick={handleDelete} disabled={busy}>
                  {busy ? "Deleting…" : "Yes, delete"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            ) : confirmingRemoveDup ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-700 font-medium">
                  Remove duplicate bulk payments from {selectedPaid.length} paid
                  ticket{selectedPaid.length !== 1 ? "s" : ""}? Tickets stay marked
                  paid; only the extra payment records are deleted.
                </span>
                <Button variant="danger" onClick={handleRemoveDup} disabled={busy}>
                  {busy ? "Removing…" : "Yes, remove"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingRemoveDup(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="h-9 w-28"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="CHECK">Check</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="OTHER">Other</option>
                  </Select>
                  <Button
                    onClick={handlePay}
                    disabled={busy || selectedPayable.length === 0}
                  >
                    {busy ? "Processing…" : `Pay ${selectedPayable.length} ticket${selectedPayable.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>
                {selectedClearable.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={handleClear}
                    disabled={busy}
                  >
                    {busy
                      ? "Clearing…"
                      : `Clear ${selectedClearable.length} paid`}
                  </Button>
                )}
                {selectedPaid.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmingRemoveDup(true)}
                    disabled={busy}
                  >
                    Remove duplicate payment
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                >
                  Delete selected
                </Button>
                <Button variant="ghost" onClick={clearSelection} disabled={busy}>
                  Deselect
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {result && (
        <div
          className={`mb-4 text-sm p-3 rounded-md ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {result.message}
        </div>
      )}

      {sections.map((section) => {
        const checkedCount = section.items.filter((i) => selected.has(i.roId)).length;
        const allChecked = section.items.length > 0 && checkedCount === section.items.length;
        const collapsible = section.defaultCollapsed === true;
        const isCollapsed = collapsed.has(section.key);
        return (
          <Card key={section.key} className="mb-4">
            <CardHeader
              title={
                collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(section.key)}
                    className="flex items-center gap-1.5 hover:text-zinc-600"
                  >
                    <span className="text-zinc-400 text-xs">
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    {section.title}
                  </button>
                ) : (
                  section.title
                )
              }
            >
              {section.items.length > 0 && !(collapsible && isCollapsed) ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.items, allChecked)}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  {allChecked ? "Deselect all" : "Select all"}
                </button>
              ) : (
                <span />
              )}
            </CardHeader>
            {collapsible && isCollapsed ? null : section.items.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500 text-center">None.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 font-medium w-8">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={() => toggleSection(section.items, allChecked)}
                        aria-label="Select all in section"
                      />
                    </th>
                    <th className="px-4 py-2 font-medium">RO #</th>
                    <th className="px-4 py-2 font-medium">Vehicle</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Opened</th>
                    {section.showCleared && (
                      <th className="px-4 py-2 font-medium">Cleared</th>
                    )}
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                    {section.showBalance && (
                      <>
                        <th className="px-4 py-2 font-medium text-right">Paid</th>
                        <th className="px-4 py-2 font-medium text-right">Balance</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {section.items.map((ro) => {
                    const isChecked = selected.has(ro.roId);
                    return (
                      <tr
                        key={ro.roId}
                        className={isChecked ? "bg-blue-50" : "hover:bg-zinc-50"}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(ro.roId)}
                            aria-label={`Select RO ${ro.roNumber}`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/repair-orders/${ro.roId}`}
                            className="font-medium text-zinc-900 hover:underline"
                          >
                            #{ro.roNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{ro.vehicle}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={ro.status} />
                        </td>
                        <td className="px-4 py-2 text-zinc-500">
                          {formatDate(ro.openedAt)}
                        </td>
                        {section.showCleared && (
                          <td className="px-4 py-2 text-zinc-500">
                            {ro.clearedAt ? formatDate(ro.clearedAt) : "—"}
                          </td>
                        )}
                        <td className="px-4 py-2 text-right">
                          {formatMoney(ro.total)}
                        </td>
                        {section.showBalance && (
                          <>
                            <td className="px-4 py-2 text-right text-zinc-500">
                              {formatMoney(ro.paid)}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-red-600">
                              {formatMoney(ro.balance)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}
    </div>
  );
}
