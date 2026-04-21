import Link from "next/link";
import { db } from "@/lib/db";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
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

  const expenses = await db.expense.findMany({
    where,
    orderBy: { paidAt: "desc" },
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Shop overhead — rent, utilities, supplies, tools, insurance, etc."
        actions={<LinkButton href="/expenses/new">+ New expense</LinkButton>}
      />

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
