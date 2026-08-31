import { db } from "@/lib/db";
import {
  computeTotals,
  excludeDeclinedJobLines,
  invoiceDateOf,
} from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { fullName, vehicleLabel } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export type ARCustomer = {
  id: string;
  name: string;
  type: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
  phone: string | null;
};

export type ARInvoice = {
  id: string;
  customerId: string;
  customer: ARCustomer;
  invoiceNumber: number;
  invoiceDate: Date;
  vehicle: string;
  total: number;
  paid: number;
  balance: number;
  daysOutstanding: number;
  bucket: AgingBucket;
};

export type ARCustomerSummary = {
  customer: ARCustomer;
  invoices: number;
  buckets: Record<AgingBucket, number>;
  total: number;
};

export type ARSummary = {
  invoices: ARInvoice[];
  customers: ARCustomerSummary[];
  buckets: Record<AgingBucket, number>;
  total: number;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function agingBucket(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function loadOpenAR(
  orgId: string,
  customerId?: string,
): Promise<ARSummary> {
  const repairOrders = await db.repairOrder.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: "INVOICED",
      ...(customerId ? { customerId } : {}),
    },
    include: {
      customer: true,
      vehicle: true,
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: { include: { part: true } },
      feeLines: true,
      payments: { select: { amount: true } },
    },
    orderBy: { invoicedAt: "asc" },
  });

  const filteredOrders = repairOrders.map(excludeDeclinedJobLines);
  const shopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    filteredOrders.map((repairOrder) => {
      const totals = computeTotals(repairOrder);
      return {
        id: repairOrder.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    }),
  );

  const today = new Date();
  const invoices: ARInvoice[] = [];
  for (const repairOrder of filteredOrders) {
    const selectedDate = invoiceDateOf(repairOrder);
    if (!selectedDate) continue;
    const totals = computeTotals({
      ...repairOrder,
      shopFees: shopFeesByRO.get(repairOrder.id) ?? [],
    });
    const paid = repairOrder.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const balance = Math.max(0, totals.total - paid);
    if (balance < 0.01) continue;

    const daysOutstanding = Math.max(
      0,
      Math.floor((today.getTime() - selectedDate.date.getTime()) / DAY_MS),
    );
    const customer: ARCustomer = {
      id: repairOrder.customer.id,
      name: fullName(repairOrder.customer),
      type: repairOrder.customer.type,
      street: repairOrder.customer.street,
      city: repairOrder.customer.city,
      state: repairOrder.customer.state,
      zip: repairOrder.customer.zip,
      email: repairOrder.customer.email,
      phone: repairOrder.customer.phone,
    };
    invoices.push({
      id: repairOrder.id,
      customerId: repairOrder.customerId,
      customer,
      invoiceNumber: repairOrder.roNumber,
      invoiceDate: selectedDate.date,
      vehicle: repairOrder.vehicle ? vehicleLabel(repairOrder.vehicle) : "—",
      total: money(totals.total),
      paid: money(paid),
      balance: money(balance),
      daysOutstanding,
      bucket: agingBucket(daysOutstanding),
    });
  }

  const buckets: Record<AgingBucket, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  const customerMap = new Map<string, ARCustomerSummary>();
  for (const invoice of invoices) {
    buckets[invoice.bucket] += invoice.balance;
    const summary = customerMap.get(invoice.customerId) ?? {
      customer: invoice.customer,
      invoices: 0,
      buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
      total: 0,
    };
    summary.invoices += 1;
    summary.buckets[invoice.bucket] += invoice.balance;
    summary.total += invoice.balance;
    customerMap.set(invoice.customerId, summary);
  }

  return {
    invoices,
    customers: Array.from(customerMap.values())
      .map((summary) => ({
        ...summary,
        buckets: {
          "0-30": money(summary.buckets["0-30"]),
          "31-60": money(summary.buckets["31-60"]),
          "61-90": money(summary.buckets["61-90"]),
          "90+": money(summary.buckets["90+"]),
        },
        total: money(summary.total),
      }))
      .sort((a, b) => b.total - a.total),
    buckets: {
      "0-30": money(buckets["0-30"]),
      "31-60": money(buckets["31-60"]),
      "61-90": money(buckets["61-90"]),
      "90+": money(buckets["90+"]),
    },
    total: money(invoices.reduce((sum, invoice) => sum + invoice.balance, 0)),
  };
}
