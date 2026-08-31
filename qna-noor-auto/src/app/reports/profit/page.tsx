import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import {
  computeTotals,
  excludeDeclinedJobLines,
  invoiceDateOf,
} from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import { prettyCategory } from "@/app/expenses/categories";
import { RangeForm } from "../RangeForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ preset?: string; from?: string; to?: string }>;
type Preset = "30d" | "mtd" | "ytd" | "12m" | "custom";

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function resolveRange(params: {
  preset?: string;
  from?: string;
  to?: string;
}): {
  preset: Preset;
  from: Date;
  to: Date;
  label: string;
} {
  const now = new Date();
  const preset: Preset =
    params.preset === "mtd" ||
    params.preset === "ytd" ||
    params.preset === "12m" ||
    params.preset === "custom"
      ? params.preset
      : "30d";
  const to = endOfDay(now);

  if (preset === "custom" && params.from) {
    const from = startOfDay(new Date(params.from));
    const customTo = params.to ? endOfDay(new Date(params.to)) : to;
    return {
      preset,
      from,
      to: customTo,
      label: `${formatDate(from)} – ${formatDate(customTo)}`,
    };
  }

  if (preset === "mtd") {
    return {
      preset,
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to,
      label: "This month",
    };
  }
  if (preset === "ytd") {
    return {
      preset,
      from: new Date(now.getFullYear(), 0, 1),
      to,
      label: "This year",
    };
  }
  if (preset === "12m") {
    return {
      preset,
      from: new Date(now.getFullYear() - 1, now.getMonth(), 1),
      to,
      label: "Last 12 months",
    };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    preset: "30d",
    from: startOfDay(from),
    to,
    label: "Last 30 days",
  };
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function marginPct(revenue: number, grossProfit: number): number | null {
  return revenue > 0 ? (grossProfit / revenue) * 100 : null;
}

type JobProfit = {
  id: string;
  date: Date;
  invoiceNumber: number;
  customerId: string;
  customer: string;
  vehicle: string;
  revenue: number;
  partsCost: number;
  laborCost: number;
  grossProfit: number;
  margin: number | null;
};

type CustomerProfit = {
  id: string;
  customer: string;
  jobs: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number | null;
};

export default async function ProfitReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const hasInvoices = enabledFeatureSet(user ?? {}).has("invoices");
  const range = resolveRange(await searchParams);

  return hasInvoices ? (
    <InvoiceProfitReport orgId={orgId} range={range} />
  ) : (
    <GeneralProfitReport orgId={orgId} range={range} />
  );
}

async function InvoiceProfitReport({
  orgId,
  range,
}: {
  orgId: string;
  range: ReturnType<typeof resolveRange>;
}) {
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
      vehicle: true,
      laborLines: {
        include: {
          technician: true,
          techAssignments: { include: { technician: true } },
        },
      },
      partLines: { include: { part: true } },
      feeLines: true,
      jobs: { select: { id: true, approvalStatus: true } },
    },
  });
  const eligible = repairOrders
    .map((repairOrder) => ({
      repairOrder,
      invoiceDate: invoiceDateOf(repairOrder),
    }))
    .filter(
      (
        row,
      ): row is {
        repairOrder: (typeof repairOrders)[number];
        invoiceDate: NonNullable<ReturnType<typeof invoiceDateOf>>;
      } =>
        row.invoiceDate != null &&
        row.invoiceDate.date >= range.from &&
        row.invoiceDate.date <= range.to,
    );
  const filtered = eligible.map((row) => ({
    ...row,
    repairOrder: excludeDeclinedJobLines(row.repairOrder),
  }));
  const preliminary = filtered.map(({ repairOrder }) => {
    const totals = computeTotals(repairOrder);
    return {
      id: repairOrder.id,
      partsSubtotal: totals.partsSubtotal,
      laborSubtotal: totals.laborSubtotal,
    };
  });
  const feesByOrder = await loadAppliedShopFeesForROs(orgId, preliminary);

  const computedJobs = filtered.map(({ repairOrder, invoiceDate }) => {
    const totals = computeTotals({
      ...repairOrder,
      shopFees: feesByOrder.get(repairOrder.id) ?? [],
    });
    const parts = repairOrder.partLines.reduce(
      (result, partLine) => {
        const cost = partLine.costPrice ?? partLine.part?.costPrice ?? null;
        return cost == null
          ? { cost: result.cost, unknown: result.unknown + 1 }
          : {
              cost: result.cost + (partLine.quantity ?? 0) * cost,
              unknown: result.unknown,
            };
      },
      { cost: 0, unknown: 0 },
    );
    const labor = repairOrder.laborLines.reduce(
      (result, laborLine) => {
        const assignments =
          laborLine.techAssignments.length > 0
            ? laborLine.techAssignments
            : laborLine.technician
              ? [{ technician: laborLine.technician, hours: laborLine.hours }]
              : [];
        return assignments.reduce(
          (assignmentResult, assignment) =>
            assignment.technician.payRate == null
              ? {
                  cost: assignmentResult.cost,
                  unknown: assignmentResult.unknown + 1,
                }
              : {
                  cost:
                    assignmentResult.cost +
                    assignment.hours * assignment.technician.payRate,
                  unknown: assignmentResult.unknown,
                },
          result,
        );
      },
      { cost: 0, unknown: 0 },
    );

    const revenue = totals.subtotal - totals.discount;
    const grossProfit = revenue - parts.cost - labor.cost;
    return {
      job: {
        id: repairOrder.id,
        date: invoiceDate.date,
        invoiceNumber: repairOrder.roNumber,
        customerId: repairOrder.customer.id,
        customer: fullName(repairOrder.customer),
        vehicle: repairOrder.vehicle ? vehicleLabel(repairOrder.vehicle) : "—",
        revenue,
        partsCost: parts.cost,
        laborCost: labor.cost,
        grossProfit,
        margin: marginPct(revenue, grossProfit),
      },
      partsCostUnknownLines: parts.unknown,
      laborCostUnknownLines: labor.unknown,
    };
  });
  const partsCostUnknownLines = computedJobs.reduce(
    (sum, row) => sum + row.partsCostUnknownLines,
    0,
  );
  const laborCostUnknownLines = computedJobs.reduce(
    (sum, row) => sum + row.laborCostUnknownLines,
    0,
  );
  const jobs: JobProfit[] = computedJobs.map(({ job }) => job);
  jobs.sort((a, b) => b.grossProfit - a.grossProfit);

  const customerMap = new Map<string, CustomerProfit>();
  for (const job of jobs) {
    const current = customerMap.get(job.customerId) ?? {
      id: job.customerId,
      customer: job.customer,
      jobs: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      margin: null,
    };
    current.jobs += 1;
    current.revenue += job.revenue;
    current.cost += job.partsCost + job.laborCost;
    current.grossProfit += job.grossProfit;
    current.margin = marginPct(current.revenue, current.grossProfit);
    customerMap.set(job.customerId, current);
  }
  const customers = Array.from(customerMap.values())
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 25);
  const revenue = jobs.reduce((sum, job) => sum + job.revenue, 0);
  const partsCost = jobs.reduce((sum, job) => sum + job.partsCost, 0);
  const laborCost = jobs.reduce((sum, job) => sum + job.laborCost, 0);
  const grossProfit = revenue - partsCost - laborCost;
  const displayedJobs = jobs.slice(0, 100);

  return (
    <>
      <PageHeader
        title="Profit by job"
        description={`Gross profit before shop expenses · ${range.label}`}
        actions={
          <LinkButton href="/reports" variant="secondary">
            Back to reports
          </LinkButton>
        }
      />
      <Card className="mb-6">
        <div className="p-4">
          <RangeForm
            preset={range.preset}
            from={range.from}
            to={range.to}
            basePath="/reports/profit"
          />
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Revenue (ex tax)" value={formatMoney(revenue)} />
        <StatCard label="Parts cost" value={formatMoney(partsCost)} />
        <StatCard label="Labor cost" value={formatMoney(laborCost)} />
        <StatCard
          label="Gross profit"
          value={formatMoney(grossProfit)}
          highlight={grossProfit < 0}
        />
        <StatCard label="Margin" value={formatPercent(marginPct(revenue, grossProfit))} />
      </div>
      <p className="mb-6 text-sm text-zinc-600">
        Shop expenses are not allocated to individual jobs, so these figures
        show gross profit rather than net profit.
      </p>

      {(partsCostUnknownLines > 0 || laborCostUnknownLines > 0) && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {partsCostUnknownLines > 0 && (
            <>
              {partsCostUnknownLines} part{" "}
              {partsCostUnknownLines === 1 ? "line has" : "lines have"} no cost
              recorded
            </>
          )}
          {partsCostUnknownLines > 0 && laborCostUnknownLines > 0 && " and "}
          {laborCostUnknownLines > 0 && (
            <>
              {laborCostUnknownLines} labor{" "}
              {laborCostUnknownLines === 1 ? "assignment has" : "assignments have"}{" "}
              no pay rate
            </>
          )}{" "}
          — those are counted as $0 cost, so profit is overstated for those
          jobs.
          {laborCostUnknownLines > 0 && (
            <>
              {" "}
              <Link href="/technicians" className="font-medium underline">
                Add technician pay rates
              </Link>
              .
            </>
          )}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader title="By job" />
        {displayedJobs.length === 0 ? (
          <EmptyState
            title="No invoiced jobs in this range"
            description="Try a different date range to see job-level gross profit."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Invoice #</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Vehicle</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Parts cost</th>
                    <th className="px-4 py-2 text-right">Labor cost</th>
                    <th className="px-4 py-2 text-right">Gross profit</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedJobs.map((job) => (
                    <tr key={job.id} className="border-b border-zinc-100">
                      <td className="px-4 py-2 text-zinc-600">
                        {formatDate(job.date)}
                      </td>
                      <td className="px-4 py-2">{job.invoiceNumber}</td>
                      <td className="px-4 py-2">{job.customer}</td>
                      <td className="px-4 py-2 text-zinc-600">{job.vehicle}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(job.revenue)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(job.partsCost)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(job.laborCost)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${
                          job.grossProfit < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {formatMoney(job.grossProfit)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatPercent(job.margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {jobs.length > displayedJobs.length && (
              <p className="px-4 py-3 text-xs text-zinc-500">
                Showing the first 100 jobs, sorted by gross profit.
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="By customer" />
        {customers.length === 0 ? (
          <EmptyState
            title="No customer profit data"
            description="Customer totals will appear when invoiced jobs are in the selected range."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Jobs</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Gross profit</th>
                  <th className="px-4 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-zinc-100">
                    <td className="px-4 py-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {customer.customer}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {customer.jobs}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(customer.revenue)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(customer.cost)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        customer.grossProfit < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {formatMoney(customer.grossProfit)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPercent(customer.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

async function GeneralProfitReport({
  orgId,
  range,
}: {
  orgId: string;
  range: ReturnType<typeof resolveRange>;
}) {
  const [income, expenses] = await Promise.all([
    db.income.findMany({
      where: { orgId, receivedAt: { gte: range.from, lte: range.to } },
      orderBy: { receivedAt: "asc" },
    }),
    db.expense.findMany({
      where: { orgId, paidAt: { gte: range.from, lte: range.to } },
      orderBy: { paidAt: "asc" },
    }),
  ]);
  const incomeBySource = new Map<string, number>();
  for (const entry of income) {
    incomeBySource.set(
      entry.source,
      (incomeBySource.get(entry.source) ?? 0) + entry.amount,
    );
  }
  const sourceRows = Array.from(incomeBySource.entries())
    .map(([source, total]) => ({
      source,
      entries: income.filter((entry) => entry.source === source).length,
      total,
    }))
    .sort((a, b) => b.total - a.total);
  const expensesByCategory = new Map<string, number>();
  for (const expense of expenses) {
    expensesByCategory.set(
      expense.category,
      (expensesByCategory.get(expense.category) ?? 0) + expense.amount,
    );
  }
  const expenseRows = Array.from(expensesByCategory.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const totalIncome = income.reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = expenses.reduce((sum, entry) => sum + entry.amount, 0);
  const net = totalIncome - totalExpenses;

  return (
    <>
      <PageHeader
        title="Income by source"
        description={`Financial summary · ${range.label}`}
        actions={
          <LinkButton href="/reports" variant="secondary">
            Back to reports
          </LinkButton>
        }
      />
      <Card className="mb-6">
        <div className="p-4">
          <RangeForm
            preset={range.preset}
            from={range.from}
            to={range.to}
            basePath="/reports/profit"
          />
        </div>
      </Card>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Income" value={formatMoney(totalIncome)} />
        <StatCard label="Expenses" value={formatMoney(totalExpenses)} />
        <StatCard label="Net" value={formatMoney(net)} highlight={net < 0} />
      </div>
      <p className="mb-6 text-sm text-zinc-600">
        This is income analysis, not profit by source: the app does not have
        per-source cost data for these accounts.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Income by source" />
          {sourceRows.length === 0 ? (
            <EmptyState
              title="No income in this range"
              description="Income entries will be grouped here by source."
            />
          ) : (
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                    <th className="py-2">Source</th>
                    <th className="py-2 text-right">Entries</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">% of income</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((row) => (
                    <tr key={row.source} className="border-b border-zinc-100">
                      <td className="py-2">{row.source}</td>
                      <td className="py-2 text-right tabular-nums">
                        {row.entries}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatMoney(row.total)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {totalIncome > 0
                          ? `${((row.total / totalIncome) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Expenses by category" />
          {expenseRows.length === 0 ? (
            <EmptyState
              title="No expenses in this range"
              description="Expenses will be grouped here by category."
            />
          ) : (
            <div className="p-4">
              <div className="space-y-2 text-sm">
                {expenseRows.map(([category, amount]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between border-b border-zinc-100 py-2"
                  >
                    <span>{prettyCategory(category)}</span>
                    <span className="tabular-nums">{formatMoney(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
