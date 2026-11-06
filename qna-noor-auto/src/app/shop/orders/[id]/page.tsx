import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";
import { shopFulfillmentLabel, shopOrderStatusLabel } from "@/lib/shop";
import { markOrderPickedUp, markOrderShipped } from "../../actions";
import { CopyAddressButton } from "../../ShopTools";

export default async function ShopOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!user.orgId) notFound();
  const order = await db.shopOrder.findFirst({
    where: { id, orgId: user.orgId },
    include: { lines: true },
  });
  if (!order) notFound();
  const manager = user.role === "OWNER" || user.role === "ADMIN";
  const address = order.shipAddress as { name?: string | null; address?: Record<string, string | null | undefined> } | null;
  const addressLines = address?.address
    ? [address.name, address.address.line1, address.address.line2, [address.address.city, address.address.state, address.address.postal_code].filter(Boolean).join(", "), address.address.country].filter(Boolean).map(String)
    : [];
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <Link href="/shop/orders" className="text-sm text-blue-700 underline">← Orders</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Order #{order.number}</h1><p className="mt-1 text-sm text-zinc-500">{shopOrderStatusLabel(order.status)} · {order.createdAt.toLocaleString()}</p></div>
        <span className="text-xl font-semibold">{formatMoney(order.total)}</span>
      </div>
      {query.error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">This order can no longer be fulfilled in that way.</p>}
      {query.saved && <p className="rounded bg-green-50 p-3 text-green-800">Order updated.</p>}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Buyer</h2>
        <p className="mt-2">{order.buyerName || "Customer"}</p>
        {order.buyerEmail && <p><a className="text-blue-700 underline" href={`mailto:${order.buyerEmail}`}>{order.buyerEmail}</a></p>}
        {order.buyerPhone && <p>{order.buyerPhone}</p>}
        <p className="mt-3">Fulfillment: {shopFulfillmentLabel(order.fulfillment)}</p>
        {addressLines.length > 0 && (
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <address className="not-italic">{addressLines.map((line) => <div key={line}>{line}</div>)}</address>
            <CopyAddressButton text={addressLines.join("\n")} />
          </div>
        )}
        {order.trackingNumber && <p className="mt-3">Tracking: {order.trackingNumber}</p>}
      </section>
      <section className="rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Items and totals</h2>
        {order.lines.map((line) => <div key={line.id} className="flex justify-between gap-4 py-2"><span>{line.itemName} × {line.quantity}</span><span>{formatMoney(line.unitPrice * line.quantity)}</span></div>)}
        <div className="flex justify-between border-t py-2"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
        <div className="flex justify-between py-2"><span>Shipping</span><span>{formatMoney(order.shipping)}</span></div>
        <div className="flex justify-between border-t pt-3 font-semibold"><span>Total</span><span>{formatMoney(order.total)}</span></div>
      </section>
      {manager && order.status === "PAID" && order.fulfillment === "SHIP" && (
        <form action={markOrderShipped.bind(null, order.id)} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
          <label className="grid gap-1 text-sm">Tracking number (optional)<input name="trackingNumber" maxLength={120} className="rounded border bg-transparent px-3 py-2" /></label>
          <button className="rounded bg-blue-700 px-4 py-2 text-white">Mark shipped</button>
        </form>
      )}
      {manager && order.status === "PAID" && order.fulfillment === "PICKUP" && (
        <form action={markOrderPickedUp.bind(null, order.id)}><button className="rounded bg-blue-700 px-4 py-2 text-white">Mark picked up</button></form>
      )}
      <p className="text-sm text-zinc-500">For refunds, use your Stripe dashboard.</p>
    </main>
  );
}
