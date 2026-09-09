import { StatCard } from "@/components/StatCard";
import { getAssistantFinancialSummary } from "@/lib/assistant";
import { loadScheduledForMonth } from "@/lib/recurring";
import {
  dateInputInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import { formatMoney } from "@/lib/utils";

export async function StatsBlock({
  orgId,
  timezone,
  hasInvoices,
  accountType,
  period = "month",
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
  accountType?: string | null;
  period?: string;
}) {
  if (hasInvoices) return null;
  const now = new Date();
  const today = localCalendarDay(now, timezone);
  const fromValue =
    period === "30d"
      ? shiftCalendarDay(today, -30)
      : period === "year"
        ? `${today.slice(0, 4)}-01-01`
        : `${today.slice(0, 7)}-01`;
  const from = dateInputInTimeZone(fromValue, timezone, new Date(Number.NaN));
  const summary = (
    await getAssistantFinancialSummary(
      orgId,
      { from, to: now },
      { timezone, now },
    )
  ).data;
  const scheduled =
    period === "month" && accountType !== "AUTO_SHOP"
      ? await loadScheduledForMonth(
          orgId,
          shiftCalendarDay(today, 1),
          new Date(
            Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
          )
            .toISOString()
            .slice(0, 10),
        )
      : [];
  const scheduledIncome = scheduled
    .filter((entry) => entry.kind === "INCOME")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const scheduledExpenses = scheduled
    .filter((entry) => entry.kind === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const hasScheduled = scheduledIncome > 0 || scheduledExpenses > 0;
  const periodLabel =
    period === "30d"
      ? "last 30 days"
      : period === "year"
        ? "this year"
        : "this month";
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <StatCard
        label={`Money in (${periodLabel})`}
        value={formatMoney(summary.moneyIn)}
        sublines={
          hasScheduled
            ? [`Expected by month end: ${formatMoney(summary.moneyIn + scheduledIncome)}`]
            : undefined
        }
      />
      <StatCard
        label={`Money out (${periodLabel})`}
        value={formatMoney(summary.moneyOut)}
        sublines={
          hasScheduled
            ? [`Expected by month end: ${formatMoney(summary.moneyOut + scheduledExpenses)}`]
            : undefined
        }
      />
      <StatCard
        label={`Net (${periodLabel})`}
        value={formatMoney(summary.net)}
        sublines={
          hasScheduled
            ? [
                `Expected by month end: ${formatMoney(
                  summary.moneyIn +
                    scheduledIncome -
                    summary.moneyOut -
                    scheduledExpenses,
                )}`,
              ]
            : undefined
        }
      />
    </div>
  );
}
