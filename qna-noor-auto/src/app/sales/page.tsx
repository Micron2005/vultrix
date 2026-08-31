import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { db } from "@/lib/db";
import {
  dateInputInTimeZone,
  formatInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
  isDateInput,
} from "@/lib/timezone";
import { formatMoney } from "@/lib/utils";
import { RangeForm } from "@/app/reports/RangeForm";
import { requireSalesOrgId, deleteSaleAction, createSaleAction } from "./actions";
import { DeleteSaleButton } from "./DeleteSaleButton";
import { SaleForm } from "./SaleForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  preset?: string;
  from?: string;
  to?: string;
  partId?: string;
}>;
type Preset = "30d" | "mtd" | "ytd" | "12m" | "custom";

function resolveRange(
  params: { preset?: string; from?: string; to?: string },
  timezone: string,
) {
  const now = new Date();
  const today = localCalendarDay(now, timezone);
  const preset: Preset =
    params.preset === "mtd" ||
    params.preset === "ytd" ||
    params.preset === "12m" ||
    params.preset === "custom"
      ? params.preset
      : "30d";
  let fromValue = shiftCalendarDay(today, -30);
  let toValue = today;
  let label = "Last 30 days";

  if (preset === "custom" && isDateInput(params.from)) {
    fromValue = params.from;
    toValue = isDateInput(params.to) ? params.to : today;
    label = `${fromValue} – ${toValue}`;
  } else if (preset === "mtd") {
    fromValue = `${today.slice(0, 7)}-01`;
    label = "This month";
  } else if (preset === "ytd") {
    fromValue = `${today.slice(0, 4)}-01-01`;
    label = "This year";
  } else if (preset === "12m") {
    fromValue = shiftCalendarDay(`${today.slice(0, 7)}-01`, -365);
    label = "Last 12 months";
  }

  const from = dateInputInTimeZone(fromValue, timezone, new Date(Number.NaN));
  const endExclusive = dateInputInTimeZone(
    shiftCalendarDay(toValue, 1),
    timezone,
    new Date(Number.NaN),
  );
  return {
    preset,
    from,
    to: new Date(endExclusive.getTime() - 1),
    fromValue,
    toValue,
    label,
  };
}

function displayDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { orgId, timezone, hasInventory } = await requireSalesOrgId();
  const params = await searchParams;
  const range = resolveRange(params, timezone);
  const [parts, sales] = await Promise.all([
    hasInventory
      ? db.part.findMany({
          where: { orgId, archived: false },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            partNumber: true,
            category: true,
            unit: true,
            costPrice: true,
            unitPrice: true,
            qtyOnHand: true,
          },
        })
      : Promise.resolve([]),
    db.sale.findMany({
      where: { orgId, soldAt: { gte: range.from, lte: range.to } },
      orderBy: { soldAt: "desc" },
    }),
  ]);
  const selectedPart = parts.find((part) => part.id === params.partId);
  const revenue = sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
  const cost = sales.reduce((sum, sale) => sum + sale.quantity * (sale.unitCost ?? 0), 0);
  const grossProfit = revenue - cost;
  const units = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const productMap = new Map<
    string,
    { itemName: string; units: number; revenue: number; cost: number; profit: number }
  >();
  for (const sale of sales) {
    const row = productMap.get(sale.itemName) ?? {
      itemName: sale.itemName,
      units: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
    };
    row.units += sale.quantity;
    row.revenue += sale.quantity * sale.unitPrice;
    row.cost += sale.quantity * (sale.unitCost ?? 0);
    row.profit = row.revenue - row.cost;
    productMap.set(sale.itemName, row);
  }
  const products = Array.from(productMap.values()).sort(
    (a, b) => b.units - a.units || b.profit - a.profit,
  );
  return (
    <>
      <PageHeader
        title="Sales"
        description={`Record products you sold and see money in and profit · ${range.label}`}
        actions={<LinkButton href="/expenses" variant="secondary">Financials</LinkButton>}
      />

      <Card className="mb-4">
        <div className="p-4">
          <RangeForm
            preset={range.preset}
            from={range.from}
            to={range.to}
            basePath="/sales"
          />
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Summary label="Revenue" value={formatMoney(revenue)} />
        <Summary label="Cost" value={formatMoney(cost)} />
        <Summary label="Gross profit" value={formatMoney(grossProfit)} />
        <Summary label="Margin" value={formatPercent(revenue > 0 ? (grossProfit / revenue) * 100 : 0)} />
        <Summary label="Units sold" value={units.toLocaleString("en-US")} />
      </div>

      <div id="record-sale">
      <Card className="mb-6">
        <CardHeader title="Record a sale" />
        <div className="p-4">
          <SaleForm
            action={createSaleAction}
            parts={parts}
            initial={{
              soldAt: localCalendarDay(new Date(), timezone),
              partId: selectedPart?.id ?? null,
              itemName: selectedPart?.name ?? "",
              quantity: 1,
              unitPrice: selectedPart?.unitPrice ?? null,
              unitCost: selectedPart?.costPrice ?? null,
              channel: null,
              note: null,
            }}
          />
        </div>
      </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="By product" />
        {products.length === 0 ? (
          <EmptyState title="No sales in this period" description="Record a sale to see product performance here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2 text-right">Units sold</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {products.map((product) => (
                  <tr key={product.itemName}>
                    <td className="px-4 py-2 font-medium text-zinc-900">{product.itemName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{product.units}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(product.revenue)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(product.cost)}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMoney(product.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={`Sales (${sales.length})`} />
        {sales.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No sales recorded in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sales.map((sale) => {
                  const saleRevenue = sale.quantity * sale.unitPrice;
                  const saleCost = sale.quantity * (sale.unitCost ?? 0);
                  return (
                    <tr key={sale.id} className="hover:bg-zinc-50">
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                        {displayDate(sale.soldAt, timezone)}
                      </td>
                      <td className="px-4 py-2 font-medium text-zinc-900">{sale.itemName}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{sale.quantity}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(sale.unitPrice)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(saleRevenue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(saleCost)}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {formatMoney(saleRevenue - saleCost)}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{sale.channel ?? "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/sales/${sale.id}/edit`} className="text-sm text-zinc-700 hover:underline">
                            Edit
                          </Link>
                          <DeleteSaleButton action={deleteSaleAction} saleId={sale.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
    </Card>
  );
}
