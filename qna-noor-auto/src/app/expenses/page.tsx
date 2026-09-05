import Link from "next/link";
import { Camera } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import {
  prettyCategory,
  prettyFrequency,
  prettyInterval,
  prettyMethod,
  repeatDescription,
} from "./categories";
import { enabledFeatureSet } from "@/lib/features";
import {
  dateInputInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  deleteRecurring,
  postAllConfirmed,
  postConfirmed,
  skipConfirmed,
  toggleRecurring,
} from "./recurring-actions";
import { postDueForOrg } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export default async function ExpensesListPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string }>;
}) {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const showIncome = Boolean(
    user && !enabledFeatureSet(user).has("invoices"),
  );
  const timezone = await orgTimeZone(orgId);
  const sp = await searchParams;
  const from = sp.from
    ? dateInputInTimeZone(sp.from, timezone, new Date(Number.NaN))
    : null;
  const to = sp.to
    ? dateInputInTimeZone(sp.to, timezone, new Date(Number.NaN))
    : null;
  const category = sp.category?.trim() || null;
  const recurringResult = await postDueForOrg(orgId, { includeConfirm: true });

  const where: {
    orgId: string;
    paidAt?: { gte?: Date; lte?: Date };
    category?: string;
  } = { orgId };
  if (from || to) {
    where.paidAt = {};
    if (from && !isNaN(from.getTime())) where.paidAt.gte = from;
    if (to && !isNaN(to.getTime())) {
      const endExclusive = dateInputInTimeZone(
        shiftCalendarDay(sp.to ?? "", 1),
        timezone,
        new Date(Number.NaN),
      );
      const end = new Date(endExclusive.getTime() - 1);
      where.paidAt.lte = end;
    }
  }
  if (category) where.category = category;

  // Month-to-date window for the top summary cards. Independent of the
  // filters below so the summary always reflects the current month.
  const now = new Date();
  const today = localCalendarDay(now, timezone);
  const mtdFrom = dateInputInTimeZone(
    `${today.slice(0, 7)}-01`,
    timezone,
    new Date(Number.NaN),
  );
  const mtdEndExclusive = dateInputInTimeZone(
    shiftCalendarDay(today, 1),
    timezone,
    new Date(Number.NaN),
  );
  const mtdTo = new Date(mtdEndExclusive.getTime() - 1);

  const [
    expenses,
    mtdPayments,
    mtdExpenses,
    invoicedROs,
    incomeEntries,
    mtdIncome,
    recurringEntries,
    budgetEntries,
  ] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { paidAt: "desc" },
      include: {
        recurring: true,
        _count: { select: { receipts: true } },
      },
    }),
    showIncome
      ? Promise.resolve([])
      : db.payment.findMany({
          where: {
            orgId,
            paidAt: { gte: mtdFrom, lte: mtdTo },
            repairOrder: { deletedAt: null },
          },
          select: { amount: true },
        }),
    db.expense.findMany({
      where: { orgId, paidAt: { gte: mtdFrom, lte: mtdTo } },
      select: { amount: true, category: true },
    }),
    showIncome
      ? Promise.resolve([])
      : db.repairOrder.findMany({
          where: { orgId, status: "INVOICED" },
          include: {
            laborLines: true,
            partLines: true,
            feeLines: true,
            payments: { select: { amount: true } },
          },
        }),
    showIncome
      ? db.income.findMany({
          where: { orgId },
          orderBy: { receivedAt: "desc" },
          include: { recurring: true },
        })
      : Promise.resolve([]),
    showIncome
      ? db.income.findMany({
          where: { orgId, receivedAt: { gte: mtdFrom, lte: mtdTo } },
          select: { amount: true },
        })
      : Promise.resolve([]),
    db.recurringEntry.findMany({
      where: { orgId },
      orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    }),
    db.budget.findMany({
      where: { orgId },
      orderBy: { category: "asc" },
    }),
  ]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const mtdRevenue = showIncome
    ? mtdIncome.reduce((s, income) => s + income.amount, 0)
    : mtdPayments.reduce((s, p) => s + p.amount, 0);
  const mtdExpensesTotal = mtdExpenses.reduce((s, e) => s + e.amount, 0);
  const mtdNet = mtdRevenue - mtdExpensesTotal;
  const mtdActualByCategory = new Map<string, number>();
  for (const expense of mtdExpenses) {
    const key = expense.category.toLowerCase();
    mtdActualByCategory.set(
      key,
      (mtdActualByCategory.get(key) ?? 0) + expense.amount,
    );
  }
  const budgetHighlights = budgetEntries
    .map((budget) => ({
      ...budget,
      actual: mtdActualByCategory.get(budget.category.toLowerCase()) ?? 0,
    }))
    .filter((budget) => budget.actual >= budget.amount * 0.9)
    .sort(
      (a, b) =>
        b.actual / b.amount - a.actual / a.amount ||
        a.category.localeCompare(b.category),
    )
    .slice(0, 5);

  // Sum outstanding balance across every RO currently in the INVOICED state.
  // Shop fees are applied the same way `/reports` computes them.
  const arShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
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
  const dueConfirm = recurringResult.dueConfirm;

  return (
    <>
      <PageHeader
        title="Financials"
        description={
          showIncome
            ? "Money in, expenses, and net income — all in one place."
            : "Revenue, money owed, and shop expenses — all in one place."
        }
        actions={
          <>
            <LinkButton href="/expenses/budget" variant="secondary">
              Budgets
            </LinkButton>
            <LinkButton href="/expenses/new">+ New expense</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard
          label={showIncome ? "Money in this month" : "Revenue this month"}
          value={formatMoney(mtdRevenue)}
        />
        {!showIncome && (
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
        )}
        <SummaryCard
          label="Expenses this month"
          value={formatMoney(mtdExpensesTotal)}
        />
        <SummaryCard
          label="Net this month"
          value={formatMoney(mtdNet)}
          sub={showIncome ? "Money in − expenses" : "Revenue − expenses"}
        />
      </div>

      <Card className="mb-4">
        <CardHeader title="Budgets">
          <Link
            href="/expenses/budget"
            className="text-sm font-medium text-zinc-700 hover:underline"
          >
            {budgetEntries.length > 0 ? "View all budgets" : "Set budgets"}
          </Link>
        </CardHeader>
        {budgetEntries.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Set monthly budgets to compare planned and actual spending.
          </p>
        ) : budgetHighlights.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            All budgeted categories are below 90% for this month.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200">
            {budgetHighlights.map((budget) => {
              const over = budget.actual > budget.amount;
              return (
                <div
                  key={budget.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-800">
                    {prettyCategory(budget.category)}
                  </span>
                  <span
                    className={`shrink-0 text-right text-xs tabular-nums ${
                      over ? "font-medium text-red-700" : "text-amber-700"
                    }`}
                  >
                    {formatMoney(budget.actual)} / {formatMoney(budget.amount)}
                    <span className="ml-2">
                      {over
                        ? `Over by ${formatMoney(budget.actual - budget.amount)}`
                        : `${formatMoney(budget.amount - budget.actual)} remaining`}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {dueConfirm.length > 0 && (
        <Card className="mb-4 border-amber-200">
          <CardHeader title="Due now">
            <form action={postAllConfirmed}>
              <button
                type="submit"
                className="text-sm font-medium text-amber-800 hover:underline"
              >
                Post all
              </button>
            </form>
          </CardHeader>
          <div className="divide-y divide-zinc-200">
            {dueConfirm.map((due) => (
              <div
                key={`${due.recurringId}-${due.occurrence.toISOString()}`}
                className="flex flex-col gap-3 p-4 md:flex-row md:items-end"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900">
                    {due.kind === "INCOME"
                      ? `Income from ${due.source || "income"}`
                      : `Expense for ${due.vendor || due.category || "other"}`}
                  </div>
                  <div className="text-sm text-zinc-500">
                    {formatDate(due.occurrence)} · {prettyInterval(due.interval)}
                  </div>
                </div>
                <form action={postConfirmed} className="flex items-end gap-2">
                  <input type="hidden" name="recurringId" value={due.recurringId} />
                  <input type="hidden" name="occurrence" value={due.occurrence.toISOString()} />
                  <label className="text-xs text-zinc-600">
                    Amount
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={due.amount}
                      className="mt-1 block w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="h-9 rounded-md bg-[var(--vx-accent-600)] px-3 text-sm font-medium text-white"
                  >
                    Post
                  </button>
                </form>
                <form action={skipConfirmed}>
                  <input type="hidden" name="recurringId" value={due.recurringId} />
                  <input type="hidden" name="occurrence" value={due.occurrence.toISOString()} />
                  <button
                    type="submit"
                    className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700"
                  >
                    Skip
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader title="Repeating">
          <div className="flex gap-2">
            <LinkButton href="/expenses/recurring/new" size="sm">
              + Expense
            </LinkButton>
            {showIncome && (
              <LinkButton
                href="/expenses/recurring/new?kind=INCOME"
                size="sm"
                variant="secondary"
              >
                + Income
              </LinkButton>
            )}
          </div>
        </CardHeader>
        {recurringEntries.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No repeating entries yet.</p>
        ) : (
          <div className="divide-y divide-zinc-200">
            {recurringEntries.map((series) => (
              <div
                key={series.id}
                className="flex flex-col gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900">
                    {series.kind === "INCOME"
                      ? `Income from ${series.source || "income"}`
                      : `Expense for ${series.vendor || series.category || "other"}`}
                  </div>
                  <div className="text-sm text-zinc-500">
                    {formatMoney(series.amount)} · {repeatDescription(series.interval)} · next{" "}
                    {formatDate(series.nextRunAt)}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    series.autoPost
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {series.autoPost ? "Auto" : "Ask"}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    series.active
                      ? "bg-zinc-100 text-zinc-700"
                      : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {series.active ? "Active" : "Paused"}
                </span>
                <LinkButton
                  href={`/expenses/recurring/${series.id}/edit`}
                  size="sm"
                  variant="secondary"
                >
                  Edit
                </LinkButton>
                <form action={toggleRecurring}>
                  <input type="hidden" name="id" value={series.id} />
                  <button
                    type="submit"
                    className="h-8 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700"
                  >
                    {series.active ? "Pause" : "Resume"}
                  </button>
                </form>
                <form action={deleteRecurring}>
                  <input type="hidden" name="id" value={series.id} />
                  <button
                    type="submit"
                    className="h-8 rounded-md border border-red-200 px-3 text-sm text-red-700"
                  >
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <p className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500">
          Deleting a repeating entry keeps all existing posted expenses and income.
        </p>
      </Card>

      {showIncome && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Income</h2>
            <LinkButton href="/expenses/income/new" size="sm">
              + New income
            </LinkButton>
          </div>
          {incomeEntries.length === 0 ? (
            <EmptyState
              title="No income yet."
              description="Log your earnings so money in and net income reflect your real month."
              action={<LinkButton href="/expenses/income/new">+ Add income</LinkButton>}
            />
          ) : (
            <Card className="mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Frequency</th>
                    <th className="px-4 py-2 font-medium">Note</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {incomeEntries.map((income) => (
                    <tr key={income.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 text-zinc-700 whitespace-nowrap">
                        <Link
                          href={`/expenses/income/${income.id}/edit`}
                          className="hover:underline"
                        >
                          {formatDate(income.receivedAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-700">
                        {income.source}
                      </td>
                      <td className="px-4 py-2 text-zinc-500">
                        {prettyFrequency(income.recurring?.interval ?? income.frequency)}
                      </td>
                      <td className="px-4 py-2 text-zinc-500">
                        {income.note ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-zinc-900 tabular-nums">
                        {formatMoney(income.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          {showIncome ? "Expenses" : "Shop expenses"}
        </h2>
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
              className="inline-flex items-center rounded-md bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] h-9 px-3 text-sm font-medium hover:bg-[var(--vx-accent-700)]"
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
          description="Track your spending so your profit-and-loss is accurate."
          action={<LinkButton href="/expenses/new">+ New expense</LinkButton>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
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
                    <span>{prettyCategory(e.category)}</span>
                    {e._count.receipts > 0 && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-500"
                        title={`${e._count.receipts} receipt photo${e._count.receipts === 1 ? "" : "s"}`}
                        aria-label={`${e._count.receipts} receipt photo${e._count.receipts === 1 ? "" : "s"}`}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {e._count.receipts}
                      </span>
                    )}
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
          </div>
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
