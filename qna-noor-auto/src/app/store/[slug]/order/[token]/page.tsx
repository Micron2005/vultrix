import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { shopOrderStatusLabel } from "@/lib/shop";
import { ClearShopCartOnNew } from "../../../StorefrontClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}): Promise<Metadata> {
  const { slug, token } = await params;
  const shop = await db.shop.findUnique({ where: { slug } });
  if (!shop?.enabled) return { title: "Order" };
  const order = await db.shopOrder.findFirst({
    where: { publicToken: token, orgId: shop.orgId },
    select: { number: true },
  });
  return { title: order ? `Order #${order.number}` : "Order" };
}

export default async function PublicShopOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ slug, token }, query] = await Promise.all([params, searchParams]);
  const shop = await db.shop.findUnique({ where: { slug } });
  if (!shop?.enabled) notFound();
  const order = await db.shopOrder.findFirst({
    where: { publicToken: token, orgId: shop.orgId },
    include: { lines: true },
  });
  if (!order) notFound();
  const address = order.shipAddress as { name?: string | null; address?: Record<string, string | null | undefined> } | null;
  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ClearShopCartOnNew slug={slug} clear={query.new === "1"} />
        <h1 className="text-3xl font-bold">Order #{order.number}</h1>
        <p className="mt-2 text-lg font-medium">{shopOrderStatusLabel(order.status)}</p>
        <div className="my-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {order.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-4 p-4">
              <span>{line.itemName} × {line.quantity}</span>
              <span>{formatMoney(line.unitPrice * line.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between p-4"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          {order.shipping > 0 && <div className="flex justify-between p-4"><span>Shipping</span><span>{formatMoney(order.shipping)}</span></div>}
          <div className="flex justify-between p-4 font-semibold"><span>Total</span><span>{formatMoney(order.total)}</span></div>
        </div>
        <p>Fulfillment: {order.fulfillment === "SHIP" ? "Shipping" : "Pickup"}</p>
        {address?.address && (
          <address className="mt-3 not-italic text-zinc-600 dark:text-zinc-300">
            {[address.name, address.address.line1, address.address.line2, address.address.city, address.address.state, address.address.postal_code, address.address.country].filter(Boolean).join(", ")}
          </address>
        )}
        {order.trackingNumber && <p className="mt-3">Tracking: {order.trackingNumber}</p>}
        {order.fulfilledAt && <p className="mt-2 text-sm text-zinc-500">Fulfilled {order.fulfilledAt.toLocaleDateString()}</p>}
        <p className="mt-10 text-center text-sm text-zinc-500">Powered by Vultrix</p>
      </div>
    </main>
  );
}
