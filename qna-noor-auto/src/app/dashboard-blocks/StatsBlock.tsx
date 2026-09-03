import { StatCard } from "@/components/StatCard";
import { getAssistantFinancialSummary } from "@/lib/assistant";
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
  period = "month",
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
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
  const periodLabel =
    period === "30d"
      ? "last 30 days"
      : period === "year"
        ? "this year"
        : "this month";
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <StatCard label={`Money in (${periodLabel})`} value={formatMoney(summary.moneyIn)} />
      <StatCard label={`Money out (${periodLabel})`} value={formatMoney(summary.moneyOut)} />
      <StatCard label={`Net (${periodLabel})`} value={formatMoney(summary.net)} />
    </div>
  );
}
