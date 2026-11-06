import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

export default async function ShopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  if (!user.orgId) return null;
  const query = await searchParams;
  const filter = ["new", "done"].includes(query.filter ?? "") ? query.filter! : "all";
  const where = filter === "new"
    ? { orgId: user.orgId, status: "PAID" }
    : filter === "done"
      ? { orgId: user.orgId, status: { in: ["SHIPPED", "PICKED_UP"] } }
      : { orgId: user.orgId };
  const orders = await db.shopOrder.findMany({
    where,
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div><Link href="/shop" className="text-sm text-blue-700 underline">← Shop</Link><h1 className="mt-2 text-2xl font-bold">Shop orders</h1></div>
      </div>
      <nav className="flex gap-2 text-sm">
        {(["new", "done", "all"] as const).map((value) => (
          <Link key={value} href={`/shop/orders?filter=${value}`} className={`rounded-full border px-4 py-2 ${filter === value ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}>
            {value === "new" ? "New" : value === "done" ? "Done" : "All"}
          </Link>
        ))}
      </nav>
      {!orders.length ? <p className="rounded-xl border p-6 text-zinc-500">No orders in this view.</p> : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/shop/orders/${order.id}`} className="block rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>#{order.number} · {order.buyerName || order.buyerEmail || "Customer"}</strong>
                <span>{formatMoney(order.total)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{order.status} · {order.fulfillment} · {order.createdAt.toLocaleString()}</p>
              <p className="mt-2 text-sm">{order.lines.map((line) => `${line.itemName} × ${line.quantity}`).join(", ")}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
