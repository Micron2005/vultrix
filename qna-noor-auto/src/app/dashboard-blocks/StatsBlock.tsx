import { StatCard } from "@/components/StatCard";
import { getAssistantFinancialSummary } from "@/lib/assistant";
import { formatMoney } from "@/lib/utils";

export async function StatsBlock({
  orgId,
  hasInvoices,
}: {
  orgId: string;
  hasInvoices: boolean;
}) {
  if (hasInvoices) return null;
  const summary = (await getAssistantFinancialSummary(orgId)).data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <StatCard label="Money in (this month)" value={formatMoney(summary.moneyIn)} />
      <StatCard label="Money out (this month)" value={formatMoney(summary.moneyOut)} />
      <StatCard label="Net (this month)" value={formatMoney(summary.net)} />
    </div>
  );
}
