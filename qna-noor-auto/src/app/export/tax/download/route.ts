import JSZip from "jszip";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { requireOrgId, getCurrentUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import {
  computeTotals,
  excludeDeclinedJobLines,
  invoiceDateOf,
} from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { fullName } from "@/lib/utils";
import { requireFinancialAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type DateRange = {
  from: Date;
  to: Date;
  fromText: string;
  toText: string;
};

function dateText(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfDay(d: Date): Date {
  const value = new Date(d);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(d: Date): Date {
  const value = new Date(d);
  value.setHours(23, 59, 59, 999);
  return value;
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return startOfDay(parsed);
}

function resolveDateRange(url: URL): DateRange {
  const now = new Date();
  const fallbackFrom = new Date(now.getFullYear(), 0, 1);
  const from = parseDate(url.searchParams.get("from"));
  const toStart = parseDate(url.searchParams.get("to"));
  if (!from || !toStart || from > toStart) {
    return {
      from: startOfDay(fallbackFrom),
      to: endOfDay(now),
      fromText: dateText(fallbackFrom),
      toText: dateText(now),
    };
  }
  const to = endOfDay(toStart);
  return {
    from,
    to,
    fromText: dateText(from),
    toText: dateText(toStart),
  };
}

function csv(rows: Record<string, unknown>[], fields: string[]): string {
  return Papa.unparse(
    { fields, data: rows },
    {
      quotes: true,
    },
  );
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function GET(request: Request) {
  await requireFinancialAccess();
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const hasInvoices = enabledFeatureSet(user ?? {}).has("invoices");
  const range = resolveDateRange(new URL(request.url));

  const [expenses, payments, income] = await Promise.all([
    db.expense.findMany({
      where: { orgId, paidAt: { gte: range.from, lte: range.to } },
      orderBy: { paidAt: "asc" },
      include: { _count: { select: { receipts: true } } },
    }),
    hasInvoices
      ? db.payment.findMany({
          where: {
            orgId,
            paidAt: { gte: range.from, lte: range.to },
            repairOrder: { deletedAt: null },
          },
          orderBy: { paidAt: "asc" },
          include: {
            repairOrder: {
              include: { customer: true },
            },
          },
        })
      : Promise.resolve([]),
    hasInvoices
      ? Promise.resolve([])
      : db.income.findMany({
          where: { orgId, receivedAt: { gte: range.from, lte: range.to } },
          orderBy: { receivedAt: "asc" },
        }),
  ]);

  const expenseRows = expenses.map((expense) => ({
    date: dateText(expense.paidAt),
    category: expense.category,
    vendor: expense.vendor ?? "",
    amount: money(expense.amount),
    method: expense.method ?? "",
    reference: expense.reference ?? "",
    note: expense.note ?? "",
    receiptPhotos: expense._count.receipts,
  }));
  const expenseTotal = money(
    expenseRows.reduce((sum, expense) => sum + expense.amount, 0),
  );

  const paymentRows = hasInvoices
    ? payments.map((payment) => ({
        date: dateText(payment.paidAt),
        invoiceNumber: payment.repairOrder.roNumber,
        customer: fullName(payment.repairOrder.customer),
        method: payment.method,
        reference: payment.reference ?? "",
        amount: money(payment.amount),
      }))
    : [];
  const incomeRows = hasInvoices
    ? []
    : income.map((entry) => ({
        date: dateText(entry.receivedAt),
        source: entry.source,
        amount: money(entry.amount),
        note: entry.note ?? "",
      }));
  const moneyIn = money(
    (hasInvoices ? paymentRows : incomeRows).reduce(
      (sum, entry) => sum + entry.amount,
      0,
    ),
  );

  let taxRows: Record<string, unknown>[] = [];
  if (hasInvoices) {
    const repairOrders = await db.repairOrder.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["INVOICED", "PAID"] },
        OR: [
          { invoicedAt: { gte: range.from, lte: range.to } },
          { paidAt: { gte: range.from, lte: range.to } },
          { closedAt: { gte: range.from, lte: range.to } },
          { openedAt: { gte: range.from, lte: range.to } },
        ],
      },
      include: {
        customer: true,
        jobs: { select: { id: true, approvalStatus: true } },
        laborLines: true,
        partLines: true,
        feeLines: true,
      },
    });
    const filteredOrders = repairOrders.map(excludeDeclinedJobLines);
    const feeInputs = filteredOrders.map((repairOrder) => {
      const totals = computeTotals(repairOrder);
      return {
        id: repairOrder.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    });
    const feesByOrder = await loadAppliedShopFeesForROs(orgId, feeInputs);

    taxRows = filteredOrders.flatMap((repairOrder) => {
      const selectedDate = invoiceDateOf(repairOrder);
      if (!selectedDate) return [];
      if (selectedDate.date < range.from || selectedDate.date > range.to) {
        return [];
      }

      const totals = computeTotals({
        ...repairOrder,
        shopFees: feesByOrder.get(repairOrder.id) ?? [],
      });
      return [
        {
          date: dateText(selectedDate.date),
          dateField: selectedDate.field,
          invoiceNumber: repairOrder.roNumber,
          customer: fullName(repairOrder.customer),
          taxableBaseAfterDiscount: money(totals.taxableAfterDiscount),
          taxRatePercent: repairOrder.taxRate,
          taxBilled: money(totals.tax),
          invoiceTotal: money(totals.total),
        },
      ];
    });
  }

  const taxBilled = money(
    taxRows.reduce(
      (sum, row) => sum + Number(row.taxBilled ?? 0),
      0,
    ),
  );
  const summaryRows = [
    { label: "Date range", value: `${range.fromText} through ${range.toText}` },
    {
      label: "Basis notes",
      value: hasInvoices
        ? "Cash basis: payments received and expenses paid in this period. Sales tax is tax billed on invoices dated in this period, not tax collected."
        : "Cash basis: income received and expenses paid in this period.",
    },
    { label: "Payments received", value: moneyIn },
    { label: "Expenses total", value: expenseTotal },
    { label: "Net", value: money(moneyIn - expenseTotal) },
    ...(hasInvoices
      ? [
          { label: "Sales tax billed on invoices", value: taxBilled },
          { label: "Invoice count", value: taxRows.length },
        ]
      : []),
    { label: "Expense count", value: expenseRows.length },
  ];

  const zip = new JSZip();
  if (hasInvoices) {
    zip.file(
      "income-payments.csv",
      csv(paymentRows, [
        "date",
        "invoiceNumber",
        "customer",
        "method",
        "reference",
        "amount",
      ]),
    );
    zip.file(
      "sales-tax-by-invoice.csv",
      csv(taxRows, [
        "date",
        "dateField",
        "invoiceNumber",
        "customer",
        "taxableBaseAfterDiscount",
        "taxRatePercent",
        "taxBilled",
        "invoiceTotal",
      ]),
    );
  } else {
    zip.file(
      "income.csv",
      csv(incomeRows, ["date", "source", "amount", "note"]),
    );
  }
  zip.file(
    "expenses.csv",
    csv(expenseRows, [
      "date",
      "category",
      "vendor",
      "amount",
      "method",
      "reference",
      "note",
      "receiptPhotos",
    ]),
  );
  zip.file("summary.csv", csv(summaryRows, ["label", "value"]));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tax-export-${range.fromText}-to-${range.toText}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
