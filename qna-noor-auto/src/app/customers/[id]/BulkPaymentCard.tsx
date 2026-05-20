"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, Button, Input, Select } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { recordBulkPayment } from "../actions";

type Invoice = {
  roId: string;
  roNumber: number;
  vehicle: string;
  total: number;
  paid: number;
  balance: number;
};

type Allocation = {
  roId: string;
  roNumber: number;
  vehicle: string;
  balance: number;
  applied: number;
};

/**
 * Smart allocation: find the best combination of invoices to cover the payment.
 * 1. Try subset-sum (DP) to find invoices that exactly total the payment
 * 2. If no exact match, find the largest subset ≤ payment, then apply remainder to next invoice
 */
function allocatePayment(invoices: Invoice[], amount: number): Allocation[] {
  if (amount <= 0 || invoices.length === 0) return [];

  const sorted = [...invoices].sort((a, b) => a.balance - b.balance);
  const n = sorted.length;

  // Convert to cents for integer DP
  const amountCents = Math.round(amount * 100);
  const balancesCents = sorted.map((inv) => Math.round(inv.balance * 100));

  // DP subset sum — find the subset with sum closest to (but ≤) amountCents
  // Cap DP table size at 1M to avoid blowup on huge amounts
  if (amountCents <= 1_000_000) {
    // dp[j] = bitmask of which invoices are used to reach sum j, or -1 if unreachable
    // For efficiency with many invoices, use a Set-based approach instead
    const dp = new Map<number, number[]>();
    dp.set(0, []);

    for (let i = 0; i < n; i++) {
      const bc = balancesCents[i];
      // Iterate in reverse order of sums to avoid using same invoice twice
      const entries = Array.from(dp.entries()).sort((a, b) => b[0] - a[0]);
      for (const [sum, indices] of entries) {
        const newSum = sum + bc;
        if (newSum <= amountCents && !dp.has(newSum)) {
          dp.set(newSum, [...indices, i]);
        }
      }
    }

    // Find the largest sum ≤ amountCents
    let bestSum = 0;
    let bestIndices: number[] = [];
    for (const [sum, indices] of dp.entries()) {
      if (sum <= amountCents && sum > bestSum) {
        bestSum = sum;
        bestIndices = indices;
      }
    }

    const allocations: Allocation[] = [];
    const usedIndices = new Set(bestIndices);

    // Fully allocated invoices
    for (const i of bestIndices) {
      const inv = sorted[i];
      allocations.push({
        roId: inv.roId,
        roNumber: inv.roNumber,
        vehicle: inv.vehicle,
        balance: inv.balance,
        applied: inv.balance,
      });
    }

    // Remainder goes to the next available invoice as partial
    const remainderCents = amountCents - bestSum;
    if (remainderCents > 0) {
      const nextIdx = sorted.findIndex((_, i) => !usedIndices.has(i));
      if (nextIdx >= 0) {
        const inv = sorted[nextIdx];
        const partialAmount = Math.min(remainderCents / 100, inv.balance);
        allocations.push({
          roId: inv.roId,
          roNumber: inv.roNumber,
          vehicle: inv.vehicle,
          balance: inv.balance,
          applied: Math.round(partialAmount * 100) / 100,
        });
      }
    }

    return allocations.sort((a, b) => a.roNumber - b.roNumber);
  }

  // Fallback for very large amounts: greedy smallest-first
  const allocations: Allocation[] = [];
  let remaining = amount;
  for (const inv of sorted) {
    if (remaining <= 0.005) break;
    const applied = Math.min(remaining, inv.balance);
    allocations.push({
      roId: inv.roId,
      roNumber: inv.roNumber,
      vehicle: inv.vehicle,
      balance: inv.balance,
      applied: Math.round(applied * 100) / 100,
    });
    remaining -= applied;
    remaining = Math.round(remaining * 100) / 100;
  }
  return allocations.sort((a, b) => a.roNumber - b.roNumber);
}

export function BulkPaymentCard({
  customerId,
  invoices,
  totalOwed,
}: {
  customerId: string;
  invoices: Invoice[];
  totalOwed: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const parsedAmount = parseFloat(amount) || 0;

  const preview = useMemo(
    () => allocatePayment(invoices, parsedAmount),
    [invoices, parsedAmount],
  );

  const totalAllocated = preview.reduce((s, a) => s + a.applied, 0);

  async function handleSubmit() {
    if (parsedAmount <= 0 || preview.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("amount", String(parsedAmount));
      fd.set("method", method);
      fd.set("reference", reference);
      fd.set("note", note);
      fd.set("allocations", JSON.stringify(
        preview.map((a) => ({ roId: a.roId, applied: a.applied })),
      ));
      const res = await recordBulkPayment(fd);
      setResult(res);
      if (res.ok) {
        setAmount("");
        setReference("");
        setNote("");
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Card className="mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold text-zinc-900">
            Bulk Payment
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Record Payment
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader title="Record Bulk Payment">
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setResult(null); }}>
          Cancel
        </Button>
      </CardHeader>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={totalOwed}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Method</label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="CHECK">Check</option>
              <option value="TRANSFER">Transfer</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Reference #</label>
            <Input
              placeholder="Check # / Auth #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Note</label>
            <Input
              placeholder="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Allocation preview */}
        {parsedAmount > 0 && preview.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-zinc-700 uppercase tracking-wider mb-2">
              Allocation Preview
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">RO #</th>
                  <th className="px-3 py-2 font-medium">Vehicle</th>
                  <th className="px-3 py-2 font-medium text-right">Balance</th>
                  <th className="px-3 py-2 font-medium text-right">Applied</th>
                  <th className="px-3 py-2 font-medium text-right">Remaining</th>
                  <th className="px-3 py-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {preview.map((a) => {
                  const remaining = Math.round((a.balance - a.applied) * 100) / 100;
                  const fullyPaid = remaining < 0.01;
                  return (
                    <tr key={a.roId} className={fullyPaid ? "bg-green-50" : "bg-amber-50"}>
                      <td className="px-3 py-2 font-medium">#{a.roNumber}</td>
                      <td className="px-3 py-2">{a.vehicle}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(a.balance)}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">
                        {formatMoney(a.applied)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {fullyPaid ? "$0.00" : formatMoney(remaining)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {fullyPaid ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                            CLEARED
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                            PARTIAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300 font-medium">
                  <td colSpan={3} className="px-3 py-2 text-right text-zinc-700">
                    Total Applied:
                  </td>
                  <td className="px-3 py-2 text-right text-green-700">
                    {formatMoney(totalAllocated)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-500">
                    {formatMoney(totalOwed - totalAllocated)} left
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {parsedAmount > totalOwed && (
          <p className="text-sm text-amber-600">
            Payment exceeds total owed ({formatMoney(totalOwed)}). Only {formatMoney(totalOwed)} will be applied.
          </p>
        )}

        {result && (
          <div className={`text-sm p-3 rounded-md ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {result.message}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => { setOpen(false); setResult(null); }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={parsedAmount <= 0 || preview.length === 0 || submitting}
          >
            {submitting ? "Processing…" : `Apply ${formatMoney(Math.min(parsedAmount, totalOwed))}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
