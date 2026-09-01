import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { prettyCategory } from "@/app/expenses/categories";
import { loadExpenseCategoryTotals } from "@/lib/financialMetrics";
import {
  dateInputInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import { formatMoney } from "@/lib/utils";

function monthToDateRange(timezone: string) {
  const today = localCalendarDay(new Date(), timezone);
  const fromValue = `${today.slice(0, 7)}-01`;
  const from = dateInputInTimeZone(fromValue, timezone, new Date(Number.NaN));
  const endExclusive = dateInputInTimeZone(
    shiftCalendarDay(today, 1),
    timezone,
    new Date(Number.NaN),
  );
  return { from, to: new Date(endExclusive.getTime() - 1) };
}

export async function SpendingBlock({ orgId, timezone }: { orgId: string; timezone: string }) {
  const totals = await loadExpenseCategoryTotals(orgId, monthToDateRange(timezone));
  const topTotals = totals.slice(0, 6);
  const maxAmount = topTotals[0]?.amount ?? 0;
  return (
    <Card className="mb-6">
      <CardHeader title="Spending this month">
        <Link href="/expenses" className="text-xs font-medium text-zinc-600 underline">
          View expenses →
        </Link>
      </CardHeader>
      {topTotals.length === 0 ? (
        <div className="p-6 text-center text-sm text-zinc-500">No spending this month.</div>
      ) : (
        <div className="space-y-4 p-4">
          {topTotals.map((total) => (
            <div key={total.category}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-zinc-800">{prettyCategory(total.category)}</span>
                <span className="shrink-0 tabular-nums text-zinc-600">{formatMoney(total.amount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-zinc-700"
                  style={{ width: `${maxAmount > 0 ? (total.amount / maxAmount) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
