import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInvoiceTotals } from "@/lib/invoiceTotals";
import {
  parseDateParam,
  withApiKey,
} from "@/lib/apiV1";

export async function GET(request: Request) {
  return withApiKey(request, async (orgId) => {
    const params = new URL(request.url).searchParams;
    const from = parseDateParam(params.get("from"), "from");
    const to = parseDateParam(params.get("to"), "to", true);
    if (from instanceof Response) return from;
    if (to instanceof Response) return to;

    const [invoices, payments, expenses] = await Promise.all([
      db.repairOrder.findMany({
        where: { orgId, deletedAt: null, status: "INVOICED" },
        select: { id: true },
      }),
      db.payment.findMany({
        where: { orgId, paidAt: { gte: from, lte: to } },
        select: { amount: true },
      }),
      db.expense.findMany({
        where: { orgId, paidAt: { gte: from, lte: to } },
        select: { amount: true },
      }),
    ]);

    const totals = await Promise.all(
      invoices.map((invoice) => getInvoiceTotals(orgId, invoice.id)),
    );
    const outstandingReceivables = totals.reduce(
      (sum, total) => sum + (total?.balanceDue ?? 0),
      0,
    );
    const revenueCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const net = revenueCollected - totalExpenses;

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      outstandingReceivables: roundMoney(outstandingReceivables),
      revenueCollected: roundMoney(revenueCollected),
      totalExpenses: roundMoney(totalExpenses),
      net: roundMoney(net),
    });
  });
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
