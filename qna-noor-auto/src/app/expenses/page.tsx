import Link from "next/link";
import { db } from "@/lib/db";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { prettyCategory, prettyMethod } from "./categories";

export const dynamic = "force-dynamic";

export default async function ExpensesListPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(sp.to) : null;
  const category = sp.category?.trim() || null;

  const where: {
    paidAt?: { gte?: Date; lte?: Date };
    category?: string;
  } = {};
  if (from || to) {
    where.paidAt = {};
    if (from && !isNaN(from.getTime())) where.paidAt.gte = from;
    if (to && !isNaN(to.getTime())) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.paidAt.lte = end;
    }
  }
  if (category) where.category = category;

  // Month-to-date window for the top summary cards. Independent of the
  // filters below so the summary always reflects the current month.
  const now = new Date();
  const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdTo = new Date(now);
  mtdTo.setHours(23, 59, 59, 999);

  const [expenses, mtdPayments, mtdExpenses, invoicedROs] = await Promise.all([
    db.expense.findMany({ where, orderBy: { paidAt: "desc" } }),
    db.payment.findMany({
      where: { paidAt: { gte: mtdFrom, lte: mtdTo } },
      select: { amount: true },
    }),
    db.expense.findMany({
      where: { paidAt: { gte: mtdFrom, lte: mtdTo } },
      select: { amount: true },
    }),
    db.repairOrder.findMany({
      where: { status: "INVOICED" },
      include: {
        laborLines: true,
        partLines: true,
        feeLines: true,
        payments: { select: { amount: true } },
      },
    }),
  ]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const mtdRevenue = mtdPayments.reduce((s, p) => s + p.amount, 0);
  const mtdExpensesTotal = mtdExpenses.reduce((s, e) => s + e.amount, 0);
  const mtdNet = mtdRevenue - mtdExpensesTotal;

  // Sum outstanding balance across every RO currently in the INVOICED state.
  // Shop fees are applied the same way `/reports` computes them.
  const arShopFeesByRO = await loadAppliedShopFeesForROs(
    invoicedROs.map((ro) => {
      const t = computeTotals(ro);
      return {
        id: ro.id,
        partsSubtotal: t.partsSubtotal,
        laborSubtotal: t.laborSubtotal,
      };
    }),
  );
  let arTotal = 0;
  for (const ro of invoicedROs) {
    const shopFees = arShopFeesByRO.get(ro.id) ?? [];
    const grand = computeTotals({ ...ro, shopFees }).total;
    const paid = ro.payments.reduce((x, p) => x + p.amount, 0);
    arTotal += Math.max(0, grand - paid);
  }
  const arCount = invoicedROs.length;

  return (
    <>
      <PageHeader
        title="Financials"
        description="Revenue, money owed, and shop expenses — all in one place."
        actions={<LinkButton href="/expenses/new">+ New expense</LinkButton>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Revenue this month" value={formatMoney(mtdRevenue)} />
        <SummaryCard
          label="A/R outstanding"
          value={formatMoney(arTotal)}
          sub={
            arCount === 0
              ? "No open invoices"
              : `${arCount} invoice${arCount === 1 ? "" : "s"} unpaid`
          }
          highlight={arTotal > 0}
        />
        <SummaryCard
          label="Expenses this month"
          value={formatMoney(mtdExpensesTotal)}
        />
        <SummaryCard
          label="Net this month"
          value={formatMoney(mtdNet)}
          sub="Revenue − expenses"
        />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Shop expenses</h2>
        <Link
          href="/reports"
          className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline"
        >
          View full reports →
        </Link>
      </div>

      <Card className="p-4 mb-4">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm items-end">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">
              Category
            </span>
            <select
              name="category"
              defaultValue={sp.category ?? ""}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {[
                "RENT",
                "UTILITIES",
                "SUPPLIES",
                "TOOLS",
                "VEHICLE",
                "INSURANCE",
                "SOFTWARE",
                "MISC",
              ].map((c) => (
                <option key={c} value={c}>
                  {prettyCategory(c)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-zinc-900 text-white h-9 px-3 text-sm font-medium hover:bg-zinc-800"
            >
              Apply
            </button>
            <Link
              href="/expenses"
              className="inline-flex items-center rounded-md border border-zinc-300 h-9 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet."
          description="Track shop overhead so your profit-and-loss is accurate."
          action={<LinkButton href="/expenses/new">+ New expense</LinkButton>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Reference</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2 text-zinc-700 whitespace-nowrap">
                    <Link
                      href={`/expenses/${e.id}/edit`}
                      className="hover:underline"
                    >
                      {formatDate(e.paidAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">
                    {prettyCategory(e.category)}
                  </td>
                  <td className="px-4 py-2 text-zinc-700">
                    {e.vendor ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500 font-mono text-xs">
                    {e.reference ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {prettyMethod(e.method)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900 tabular-nums">
                    {formatMoney(e.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50">
                <td colSpan={5} className="px-4 py-2 font-medium text-zinc-900">
                  Total ({expenses.length})
                </td>
                <td className="px-4 py-2 text-right font-semibold text-zinc-900 tabular-nums">
                  {formatMoney(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (highlight
          ? "border-amber-300 bg-amber-50"
          : "border-zinc-200 bg-white")
      }
    >
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}
