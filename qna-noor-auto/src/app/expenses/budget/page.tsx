import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { db } from "@/lib/db";
import { requireOrgId, getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";
import { EXPENSE_CATEGORIES, prettyCategory } from "../categories";
import { deleteBudget, setBudget } from "../budget-actions";

export const dynamic = "force-dynamic";

type Month = {
  start: Date;
  end: Date;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function monthBounds(year: number, month: number): Month {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function parseMonth(value: string | undefined, fallback: Date): Month {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return monthBounds(fallback.getFullYear(), fallback.getMonth());
  }
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return monthBounds(fallback.getFullYear(), fallback.getMonth());
  }
  const requested = monthBounds(year, month);
  const current = monthBounds(fallback.getFullYear(), fallback.getMonth());
  return requested.start > current.start ? current : requested;
}

function addMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function categoryKey(category: string): string {
  return category.trim().toLowerCase();
}

function statusFor(actual: number, budget: number | null): {
  label: string;
  className: string;
} {
  if (budget === null) {
    return { label: "No budget set", className: "text-zinc-500" };
  }
  if (actual > budget) {
    return {
      label: `Over by ${formatMoney(actual - budget)}`,
      className: "font-medium text-red-700",
    };
  }
  if (budget > 0 && actual >= budget * 0.9) {
    return { label: "Close to budget", className: "font-medium text-amber-700" };
  }
  return {
    label: `${formatMoney(budget - actual)} remaining`,
    className: "text-zinc-600",
  };
}

function AddBudgetForm() {
  return (
    <form action={setBudget} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1 text-xs font-medium text-zinc-700">
        Category
        <Input name="category" placeholder="Marketing" required className="mt-1" />
      </label>
      <label className="w-full text-xs font-medium text-zinc-700 sm:w-36">
        Monthly amount
        <Input
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="$1,200"
          required
          className="mt-1"
        />
      </label>
      <button
        type="submit"
        className="h-10 rounded-md bg-[var(--vx-accent-600)] px-4 text-sm font-medium text-white hover:bg-[var(--vx-accent-700)]"
      >
        Add budget
      </button>
    </form>
  );
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const now = new Date();
  const currentMonth = monthBounds(now.getFullYear(), now.getMonth());
  const viewed = parseMonth((await searchParams).month, now);
  const comparisonStart = monthBounds(
    viewed.start.getFullYear(),
    viewed.start.getMonth() - 5,
  ).start;
  const [budgets, expenses] = await Promise.all([
    db.budget.findMany({ where: { orgId }, orderBy: { category: "asc" } }),
    db.expense.findMany({
      where: { orgId, paidAt: { gte: comparisonStart, lte: viewed.end } },
      select: { category: true, amount: true, paidAt: true },
    }),
  ]);

  const isAutoShop = user?.accountType === "AUTO_SHOP";
  const budgetByKey = new Map(
    budgets.map((budget) => [categoryKey(budget.category), budget]),
  );
  const categoryLabels = new Map<string, string>();
  for (const budget of budgets) {
    categoryLabels.set(categoryKey(budget.category), budget.category);
  }
  for (const expense of expenses) {
    if (expense.paidAt < viewed.start || expense.paidAt > viewed.end) continue;
    const key = categoryKey(expense.category);
    if (!categoryLabels.has(key)) categoryLabels.set(key, expense.category);
  }
  if (isAutoShop) {
    for (const category of EXPENSE_CATEGORIES) {
      if (!categoryLabels.has(categoryKey(category))) {
        categoryLabels.set(categoryKey(category), category);
      }
    }
  }

  const viewedActuals = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.paidAt < viewed.start || expense.paidAt > viewed.end) continue;
    const key = categoryKey(expense.category);
    viewedActuals.set(key, (viewedActuals.get(key) ?? 0) + expense.amount);
  }
  const rows = [...categoryLabels.entries()]
    .map(([key, category]) => ({
      key,
      category,
      actual: viewedActuals.get(key) ?? 0,
      budget: budgetByKey.get(key) ?? null,
    }))
    .sort((a, b) => b.actual - a.actual || a.category.localeCompare(b.category));

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalActual = [...viewedActuals.values()].reduce((sum, amount) => sum + amount, 0);
  const totalStatus = statusFor(totalActual, totalBudget > 0 ? totalBudget : null);
  const comparisonMonths = Array.from({ length: 6 }, (_, index) =>
    addMonth(viewed.start, index - 5),
  );
  const comparisonActuals = new Map<string, number>();
  for (const expense of expenses) {
    const key = `${categoryKey(expense.category)}:${monthKey(expense.paidAt)}`;
    comparisonActuals.set(
      key,
      (comparisonActuals.get(key) ?? 0) + expense.amount,
    );
  }
  const comparisonLabels = new Map(categoryLabels);
  for (const expense of expenses) {
    const key = categoryKey(expense.category);
    if (!comparisonLabels.has(key)) comparisonLabels.set(key, expense.category);
  }
  const comparisonCategories = [...comparisonLabels.entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const hasNoData = budgets.length === 0 && expenses.length === 0;
  const previousMonth = addMonth(viewed.start, -1);
  const nextMonth = addMonth(viewed.start, 1);
  const isCurrentMonth = viewed.start.getTime() === currentMonth.start.getTime();
  const daysInMonth = new Date(
    viewed.start.getFullYear(),
    viewed.start.getMonth() + 1,
    0,
  ).getDate();
  const daysElapsed = Math.min(now.getDate(), daysInMonth);

  return (
    <>
      <PageHeader
        title="Budgets vs actual"
        description="Track monthly spending by category and spot over-budget areas."
        actions={
          <>
            <LinkButton href="/expenses" variant="secondary" size="sm">
              Financials
            </LinkButton>
            <LinkButton href="/expenses/new" size="sm">
              + New expense
            </LinkButton>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href={`/expenses/budget?month=${monthKey(previousMonth)}`}
            className="text-sm font-medium text-zinc-700 hover:underline"
          >
            ← Previous
          </Link>
          <div className="text-center">
            <div className="text-sm font-semibold text-zinc-900">
              {monthLabel(viewed.start)}
            </div>
            {isCurrentMonth && (
              <div className="text-xs text-zinc-500">Current month</div>
            )}
          </div>
          {isCurrentMonth ? (
            <span className="text-sm text-zinc-400">Next →</span>
          ) : (
            <Link
              href={`/expenses/budget?month=${monthKey(nextMonth)}`}
              className="text-sm font-medium text-zinc-700 hover:underline"
            >
              Next →
            </Link>
          )}
        </div>
      </Card>

      {hasNoData && (
        <Card className="mb-4 p-4">
          <p className="text-sm text-zinc-600">
            Set monthly budgets to compare your spending with your plan. Budgets
            are saved by category and never change your expense history.
          </p>
        </Card>
      )}

      {!isAutoShop && (
        <Card className="mb-4">
          <CardHeader title="Add a budget" />
          <div className="p-4">
            <AddBudgetForm />
          </div>
        </Card>
      )}

      {rows.length > 0 ? (
        <Card className="mb-6 overflow-hidden">
          <CardHeader title={`Category budgets · ${monthLabel(viewed.start)}`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Monthly budget</th>
                  <th className="px-4 py-2 font-medium">Actual spent</th>
                  <th className="px-4 py-2 font-medium">Remaining / over</th>
                  <th className="px-4 py-2 font-medium">Progress</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {rows.map((row) => {
                  const budgetAmount = row.budget?.amount ?? null;
                  const status = statusFor(row.actual, budgetAmount);
                  const percent =
                    budgetAmount && budgetAmount > 0
                      ? (row.actual / budgetAmount) * 100
                      : 0;
                  const progressColor =
                    budgetAmount !== null && row.actual > budgetAmount
                      ? "bg-red-500"
                      : budgetAmount !== null && row.actual >= budgetAmount * 0.9
                        ? "bg-amber-500"
                        : "bg-zinc-700";
                  return (
                    <tr key={row.key}>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {prettyCategory(row.category)}
                      </td>
                      <td className="px-4 py-3">
                        <form action={setBudget} className="flex items-center gap-2">
                          <input type="hidden" name="category" value={row.budget?.category ?? row.category} />
                          <Input
                            name="amount"
                            type="text"
                            inputMode="decimal"
                            defaultValue={budgetAmount?.toFixed(2) ?? ""}
                            placeholder="$0.00"
                            aria-label={`${row.category} monthly budget`}
                            className="w-28"
                          />
                          <button
                            type="submit"
                            className="text-xs font-medium text-zinc-700 hover:underline"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-zinc-900">
                        {formatMoney(row.actual)}
                      </td>
                      <td className={`px-4 py-3 ${status.className}`}>
                        {status.label}
                        {isCurrentMonth && budgetAmount !== null && budgetAmount > 0 && (
                          <div className="mt-1 text-xs font-normal text-zinc-500">
                            {Math.round((row.actual / budgetAmount) * 100)}% of budget used,{" "}
                            {Math.round((daysElapsed / daysInMonth) * 100)}% through the month
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {budgetAmount === null ? (
                          <span className="text-xs text-zinc-500">No budget set</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className={`h-full ${progressColor}`}
                                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-zinc-500">
                              {Math.round(percent)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.budget && (
                          <form action={deleteBudget}>
                            <input type="hidden" name="id" value={row.budget.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-red-700 hover:underline"
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
              <tfoot className="border-t border-zinc-300 bg-zinc-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-900">Total</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-zinc-900">
                    {formatMoney(totalBudget)}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-zinc-900">
                    {formatMoney(totalActual)}
                  </td>
                  <td className={`px-4 py-3 ${totalStatus.className}`}>
                    {totalStatus.label}
                  </td>
                  <td className="px-4 py-3" colSpan={2}>
                    {totalBudget > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className={`h-full ${
                              totalActual > totalBudget
                                ? "bg-red-500"
                                : totalActual >= totalBudget * 0.9
                                  ? "bg-amber-500"
                                  : "bg-zinc-700"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, (totalActual / totalBudget) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-zinc-500">
                          {Math.round((totalActual / totalBudget) * 100)}%
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No budgets or expenses for this month."
          description="Add a budget to start tracking actual spending by category."
        />
      )}

      <Card>
        <CardHeader title="Month over month" />
        <p className="px-4 pt-3 text-xs text-zinc-500">
          Each month is compared against your current budget amount, since budgets
          aren&apos;t stored per month.
        </p>
        <div className="overflow-x-auto p-4">
          {comparisonCategories.length === 0 ? (
            <p className="text-sm text-zinc-500">No category activity yet.</p>
          ) : (
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Category</th>
                  {comparisonMonths.map((month) => (
                    <th key={monthKey(month)} className="px-2 py-2 text-right font-medium">
                      {monthLabel(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {comparisonCategories.map(([key, category]) => {
                  const budget = budgetByKey.get(key)?.amount ?? null;
                  return (
                    <tr key={key}>
                      <td className="px-2 py-2 font-medium text-zinc-800">
                        {prettyCategory(category)}
                      </td>
                      {comparisonMonths.map((month) => {
                        const actual =
                          comparisonActuals.get(`${key}:${monthKey(month)}`) ?? 0;
                        const over = budget !== null && actual > budget;
                        return (
                          <td
                            key={monthKey(month)}
                            className={`px-2 py-2 text-right tabular-nums ${
                              over ? "font-medium text-red-700" : "text-zinc-600"
                            }`}
                          >
                            {formatMoney(actual)}
                            {over && (
                              <span title="Over current budget" className="ml-1">
                                !
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}
