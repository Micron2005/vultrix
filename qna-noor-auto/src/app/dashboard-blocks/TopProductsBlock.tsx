import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { loadTopSellingProducts } from "@/lib/sales";
import {
  dateInputInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import { formatMoney } from "@/lib/utils";

function monthToDateRange(timezone: string) {
  const today = localCalendarDay(new Date(), timezone);
  const from = dateInputInTimeZone(
    `${today.slice(0, 7)}-01`,
    timezone,
    new Date(Number.NaN),
  );
  const endExclusive = dateInputInTimeZone(
    shiftCalendarDay(today, 1),
    timezone,
    new Date(Number.NaN),
  );
  return { from, to: new Date(endExclusive.getTime() - 1) };
}

export async function TopProductsBlock({
  orgId,
  timezone,
}: {
  orgId: string;
  timezone: string;
}) {
  const products = await loadTopSellingProducts(orgId, monthToDateRange(timezone), 5);
  return (
    <Card className="mb-6">
      <CardHeader title="Best sellers this month">
        <Link href="/sales" className="text-xs font-medium text-zinc-600 underline">
          View sales →
        </Link>
      </CardHeader>
      {products.length === 0 ? (
        <div className="p-6 text-center text-sm text-zinc-500">No sales this month.</div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {products.map((product) => (
            <li key={product.itemName} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">{product.itemName}</p>
                <p className="text-xs text-zinc-500">{product.units} units sold</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700">
                {formatMoney(product.revenue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
