import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import { RangeForm } from "./RangeForm";
import { prettyCategory } from "../expenses/categories";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ preset?: string; from?: string; to?: string }>;

type Preset = "30d" | "mtd" | "ytd" | "12m" | "custom";

function resolveRange(sp: { preset?: string; from?: string; to?: string }): {
  preset: Preset;
  from: Date;
  to: Date;
  label: string;
} {
  const now = new Date();
  const preset: Preset =
    sp.preset === "mtd" ||
    sp.preset === "ytd" ||
    sp.preset === "12m" ||
    sp.preset === "custom"
      ? sp.preset
      : "30d";

  let from: Date;
  const to = endOfDay(now);
  let label: string;

  if (preset === "custom" && sp.from) {
    from = startOfDay(new Date(sp.from));
    const t = sp.to ? endOfDay(new Date(sp.to)) : endOfDay(now);
    label = `${formatDate(from)} – ${formatDate(t)}`;
    return { preset, from, to: t, label };
  }

  if (preset === "mtd") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "This month";
  } else if (preset === "ytd") {
    from = new Date(now.getFullYear(), 0, 1);
    label = "This year";
  } else if (preset === "12m") {
    from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    label = "Last 12 months";
  } else {
    from = new Date(now);
    from.setDate(from.getDate() - 30);
    from = startOfDay(from);
    label = "Last 30 days";
  }

  return { preset, from, to, label };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(d);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const { preset, from, to, label } = resolveRange(sp);

  const [
    allROs,
    paymentsInRange,
    openCount,
    invoicedCount,
    allTechs,
    partLinesInRange,
    allPartsCount,
    expensesInRange,
  ] = await Promise.all([
    db.repairOrder.findMany({
      where: { orgId },
      include: {
        customer: true,
        vehicle: true,
        laborLines: { include: { technician: true } },
        partLines: { include: { part: true } },
        feeLines: true,
        payments: true,
      },
    }),
    db.payment.findMany({
      where: { orgId, paidAt: { gte: from, lte: to } },
      include: {
        repairOrder: {
          include: {
            customer: true,
            vehicle: true,
            laborLines: true,
            partLines: true,
            feeLines: true,
          },
        },
      },
    }),
    db.repairOrder.count({
      where: { orgId, status: { in: ["ESTIMATE", "IN_PROGRESS", "COMPLETED"] } },
    }),
    db.repairOrder.count({ where: { orgId, status: "INVOICED" } }),
    db.technician.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.partLine.findMany({
      where: { repairOrder: { orgId, openedAt: { gte: from, lte: to } } },
      include: { part: true, repairOrder: true },
    }),
    db.part.count({ where: { orgId, archived: false } }),
    db.expense.findMany({
      where: { orgId, paidAt: { gte: from, lte: to } },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const revenueInRange = paymentsInRange.reduce((s, p) => s + p.amount, 0);

  const arShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    allROs
      .filter((ro) => ro.status === "INVOICED")
      .map((ro) => {
        const t = computeTotals(ro);
        return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
      }),
  );
  let arTotal = 0;
  let arIndividuals = 0;
  let arBusinesses = 0;
  for (const ro of allROs) {
    if (ro.status !== "INVOICED") continue;
    const shopFees = arShopFeesByRO.get(ro.id) ?? [];
    const total = computeTotals({ ...ro, shopFees }).total;
    const paid = ro.payments.reduce((x, p) => x + p.amount, 0);
    const balance = Math.max(0, total - paid);
    arTotal += balance;
    if (ro.customer.type === "BUSINESS") arBusinesses += balance;
    else arIndividuals += balance;
  }

  const completedInRange = allROs.filter(
    (ro) =>
      ro.completedAt &&
      ro.completedAt >= from &&
      ro.completedAt <= to &&
      ro.startedAt,
  );
  const avgDaysToComplete =
    completedInRange.length > 0
      ? completedInRange.reduce(
          (s, ro) => s + daysBetween(ro.startedAt!, ro.completedAt!),
          0,
        ) / completedInRange.length
      : null;

  const paidInRangeROs = allROs.filter(
    (ro) =>
      ro.paidAt &&
      ro.paidAt >= from &&
      ro.paidAt <= to &&
      ro.invoicedAt,
  );
  const avgDaysToPayment =
    paidInRangeROs.length > 0
      ? paidInRangeROs.reduce(
          (s, ro) => s + daysBetween(ro.invoicedAt!, ro.paidAt!),
          0,
        ) / paidInRangeROs.length
      : null;

  const months: { key: string; label: string; revenue: number }[] = [];
  {
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: monthLabel(d), revenue: 0 });
    }
    const paymentsLast12 = await db.payment.findMany({
      where: {
        orgId,
        paidAt: {
          gte: new Date(months[0].key + "-01"),
          lte: to,
        },
      },
    });
    for (const p of paymentsLast12) {
      const k = monthKey(p.paidAt);
      const m = months.find((x) => x.key === k);
      if (m) m.revenue += p.amount;
    }
  }
  const maxMonthRevenue = Math.max(1, ...months.map((m) => m.revenue));

  const customerTotals = new Map<
    string,
    {
      id: string;
      name: string;
      paid: number;
      roCount: number;
    }
  >();
  for (const p of paymentsInRange) {
    const ro = p.repairOrder;
    if (!ro) continue;
    const cur = customerTotals.get(ro.customerId) ?? {
      id: ro.customerId,
      name: fullName(ro.customer),
      paid: 0,
      roCount: 0,
    };
    cur.paid += p.amount;
    customerTotals.set(ro.customerId, cur);
  }
  const roByCustomer = new Map<string, Set<string>>();
  for (const p of paymentsInRange) {
    if (!p.repairOrder) continue;
    const set =
      roByCustomer.get(p.repairOrder.customerId) ?? new Set<string>();
    set.add(p.repairOrder.id);
    roByCustomer.set(p.repairOrder.customerId, set);
  }
  for (const [cid, set] of roByCustomer) {
    const t = customerTotals.get(cid);
    if (t) t.roCount = set.size;
  }
  const topCustomers = Array.from(customerTotals.values())
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 10);

  const vehicleHours = new Map<
    string,
    {
      id: string;
      label: string;
      ownerName: string;
      hours: number;
      roCount: number;
    }
  >();
  const rosInRange = allROs.filter(
    (ro) => ro.openedAt >= from && ro.openedAt <= to,
  );
  for (const ro of rosInRange) {
    const hours = ro.laborLines.reduce((s, l) => s + (l.hours ?? 0), 0);
    if (hours <= 0) continue;
    const cur = vehicleHours.get(ro.vehicleId) ?? {
      id: ro.vehicleId,
      label: vehicleLabel(ro.vehicle),
      ownerName: fullName(ro.customer),
      hours: 0,
      roCount: 0,
    };
    cur.hours += hours;
    cur.roCount += 1;
    vehicleHours.set(ro.vehicleId, cur);
  }
  const topVehicles = Array.from(vehicleHours.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  const techRows = allTechs.map((tech) => {
    const lines = rosInRange.flatMap((ro) =>
      ro.laborLines
        .filter((l) => l.technicianId === tech.id)
        .map((l) => ({ l, ro })),
    );
    const hours = lines.reduce((s, { l }) => s + (l.hours ?? 0), 0);
    const roIds = new Set(lines.map((x) => x.ro.id));
    const avgHoursPerRO = roIds.size > 0 ? hours / roIds.size : 0;
    return {
      id: tech.id,
      name: tech.name,
      active: tech.active,
      hours,
      roCount: roIds.size,
      avgHoursPerRO,
    };
  });
  techRows.sort((a, b) => b.hours - a.hours);

  let partsRevenue = 0;
  let partsCost = 0;
  let partsLinesWithCost = 0;
  const belowCostFlags: Array<{
    roId: string;
    roNumber: number;
    description: string;
    unitPrice: number;
    costPrice: number;
  }> = [];
  for (const pl of partLinesInRange) {
    const cost =
      typeof pl.costPrice === "number"
        ? pl.costPrice
        : pl.part?.costPrice ?? null;
    if (cost === null) continue;
    const qty = pl.quantity ?? 0;
    const revenue = qty * (pl.unitPrice ?? 0);
    const costTotal = qty * cost;
    partsRevenue += revenue;
    partsCost += costTotal;
    partsLinesWithCost += 1;
    if (cost > 0 && pl.unitPrice < cost) {
      belowCostFlags.push({
        roId: pl.repairOrderId,
        roNumber: pl.repairOrder?.roNumber ?? 0,
        description: pl.description,
        unitPrice: pl.unitPrice,
        costPrice: cost,
      });
    }
  }
  const partsMargin = partsRevenue - partsCost;
  const partsMarkupPct =
    partsCost > 0 ? ((partsRevenue - partsCost) / partsCost) * 100 : null;

  const expensesTotal = expensesInRange.reduce((s, e) => s + e.amount, 0);
  const expensesByCategory = new Map<string, number>();
  for (const e of expensesInRange) {
    expensesByCategory.set(
      e.category,
      (expensesByCategory.get(e.category) ?? 0) + e.amount,
    );
  }
  const expenseCategoryRows = Array.from(expensesByCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const netProfit = revenueInRange - partsCost - expensesTotal;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Business metrics · ${label}`}
      />

      <Card className="mb-6">
        <div className="p-4">
          <RangeForm preset={preset} from={from} to={to} />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Stat label="Revenue" value={formatMoney(revenueInRange)} />
        <Stat
          label="A/R (outstanding)"
          value={formatMoney(arTotal)}
          highlight={arTotal > 0}
          sublines={
            arTotal > 0
              ? [
                  `Individuals · ${formatMoney(arIndividuals)}`,
                  `Businesses · ${formatMoney(arBusinesses)}`,
                ]
              : undefined
          }
        />
        <Stat label="Open ROs" value={openCount.toString()} />
        <Stat label="Invoiced (unpaid)" value={invoicedCount.toString()} />
        <Stat
          label="Avg days to complete"
          value={avgDaysToComplete !== null ? avgDaysToComplete.toFixed(1) : "—"}
        />
        <Stat
          label="Avg days to payment"
          value={avgDaysToPayment !== null ? avgDaysToPayment.toFixed(1) : "—"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader title={`Profit & loss (${label.toLowerCase()})`} />
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="space-y-1">
              <PLRow
                label="Revenue (payments received)"
                value={formatMoney(revenueInRange)}
              />
              <PLRow
                label="Parts cost"
                value={`− ${formatMoney(partsCost)}`}
              />
              <PLRow
                label={
                  <Link
                    href="/expenses"
                    className="text-zinc-700 hover:underline"
                  >
                    Shop expenses ({expensesInRange.length})
                  </Link>
                }
                value={`− ${formatMoney(expensesTotal)}`}
              />
              <div className="h-px bg-zinc-200 my-2" />
              <PLRow
                label={
                  <span className="font-semibold">Net profit</span>
                }
                value={
                  <span
                    className={
                      "font-semibold " +
                      (netProfit >= 0 ? "text-emerald-700" : "text-red-700")
                    }
                  >
                    {formatMoney(netProfit)}
                  </span>
                }
              />
            </div>
            <div className="mt-3 text-[11px] text-zinc-500">
              Net profit = revenue − parts cost − shop expenses.
              Labor cost (techs) is not subtracted here. Parts cost only
              includes items linked to the catalog with a recorded cost.
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Expenses by category
            </div>
            {expenseCategoryRows.length === 0 ? (
              <div className="text-zinc-500">
                No expenses recorded in this range.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-200">
                  {expenseCategoryRows.map((row) => {
                    const pct =
                      expensesTotal > 0
                        ? (row.amount / expensesTotal) * 100
                        : 0;
                    return (
                      <tr key={row.category}>
                        <td className="py-1.5 text-zinc-700">
                          {prettyCategory(row.category)}
                        </td>
                        <td className="py-1.5 text-zinc-500 text-right w-12">
                          {pct.toFixed(0)}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-900">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Revenue by month (last 12 months)" />
        <div className="p-4">
          {maxMonthRevenue <= 0 ? (
            <div className="text-sm text-zinc-500">
              No payments recorded in the last 12 months.
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-2 items-end h-40">
              {months.map((m) => {
                const pct = (m.revenue / maxMonthRevenue) * 100;
                return (
                  <div
                    key={m.key}
                    className="flex flex-col items-center justify-end gap-1 h-full"
                    title={`${m.label}: ${formatMoney(m.revenue)}`}
                  >
                    <div className="text-[10px] text-zinc-600 leading-none">
                      {m.revenue > 0 ? formatMoney(m.revenue) : ""}
                    </div>
                    <div
                      className="w-full bg-zinc-900 rounded-t"
                      style={{ height: `${Math.max(2, pct)}%` }}
                    />
                    <div className="text-[10px] text-zinc-500 leading-none">
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader title={`Top customers (${label.toLowerCase()})`} />
          {topCustomers.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              No payments received in this range.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-600">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">ROs</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {topCustomers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600">
                      {c.roCount}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatMoney(c.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title={`Top vehicles by labor hours (${label.toLowerCase()})`} />
          {topVehicles.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              No labor logged on any vehicle in this range.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-600">
                <tr>
                  <th className="px-4 py-2">Vehicle</th>
                  <th className="px-4 py-2">Owner</th>
                  <th className="px-4 py-2 text-right">ROs</th>
                  <th className="px-4 py-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {topVehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/vehicles/${v.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        {v.label}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{v.ownerName}</td>
                    <td className="px-4 py-2 text-right text-zinc-600">
                      {v.roCount}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {v.hours.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title={`Tech productivity (${label.toLowerCase()})`} />
        {techRows.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">
            No technicians set up yet. Add one from the Technicians tab.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-600">
              <tr>
                <th className="px-4 py-2">Technician</th>
                <th className="px-4 py-2 text-right">ROs</th>
                <th className="px-4 py-2 text-right">Hours</th>
                <th className="px-4 py-2 text-right">Avg hrs / RO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {techRows.map((t) => (
                <tr key={t.id} className={t.active ? "" : "text-zinc-400"}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/technicians/${t.id}`}
                      className="hover:underline"
                    >
                      {t.name}
                      {!t.active && (
                        <span className="ml-2 text-xs text-zinc-400">
                          (inactive)
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {t.roCount}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {t.hours.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {t.roCount > 0 ? t.avgHoursPerRO.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mb-6">
        <CardHeader title={`Parts margin (${label.toLowerCase()})`} />
        <div className="p-4">
          {partsLinesWithCost === 0 ? (
            <div className="text-sm text-zinc-500">
              No parts with cost data sold in this range. Costs come from the
              inventory catalog or from the RO part line directly.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Parts revenue" value={formatMoney(partsRevenue)} />
                <Stat label="Parts cost" value={formatMoney(partsCost)} />
                <Stat
                  label="Gross margin"
                  value={formatMoney(partsMargin)}
                  highlight={partsMargin < 0}
                />
                <Stat
                  label="Avg markup"
                  value={
                    partsMarkupPct !== null
                      ? partsMarkupPct.toFixed(0) + "%"
                      : "—"
                  }
                />
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                Based on {partsLinesWithCost} part line
                {partsLinesWithCost === 1 ? "" : "s"} with cost data.{" "}
                {allPartsCount} active catalog part
                {allPartsCount === 1 ? "" : "s"}.
              </div>
              {belowCostFlags.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-900">
                    {belowCostFlags.length} part line
                    {belowCostFlags.length === 1 ? "" : "s"} sold below cost:
                  </div>
                  <ul className="mt-1 text-xs text-amber-900 space-y-0.5">
                    {belowCostFlags.slice(0, 8).map((b, i) => (
                      <li key={i}>
                        <Link
                          href={`/repair-orders/${b.roId}`}
                          className="hover:underline"
                        >
                          RO #{b.roNumber}
                        </Link>
                        {" · "}
                        {b.description} · charged {formatMoney(b.unitPrice)},
                        cost {formatMoney(b.costPrice)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function PLRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="text-zinc-700">{label}</div>
      <div className="tabular-nums text-zinc-900">{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  sublines,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  sublines?: string[];
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
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
      {sublines && sublines.length > 0 && (
        <div className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
          {sublines.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
