import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import { suggestedShopSlug } from "@/lib/shop";
import { ShopShareTools, ShopPhotoManager } from "./ShopTools";
import { saveShopSettings, setShopListed } from "./actions";

export default async function ShopManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  if (!user.orgId) return null;
  const [org, shop, query] = await Promise.all([
    db.organization.findUnique({
      where: { id: user.orgId },
      select: { id: true, name: true, accountType: true, features: true, stripeConnectChargesEnabled: true, stripeConnectAccountId: true },
    }),
    db.shop.findUnique({ where: { orgId: user.orgId } }),
    searchParams,
  ]);
  if (!org) return null;
  const manager = user.role === "OWNER" || user.role === "ADMIN";
  const inventoryEnabled = enabledFeatureSet(org).has("inventory");
  const parts = inventoryEnabled
    ? await db.part.findMany({
        where: { orgId: user.orgId, archived: false },
        include: { photos: { orderBy: { position: "asc" }, select: { id: true, position: true } } },
        orderBy: { name: "asc" },
      })
    : [];
  const headersList = await headers();
  const origin = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("x-forwarded-host") ?? headersList.get("host")}`;
  const slug = shop?.slug ?? suggestedShopSlug(org.name);
  const shopUrl = `${origin}/store/${encodeURIComponent(slug)}`;
  const shareQr = await QRCode.toDataURL(shopUrl, { width: 280, margin: 1 });
  const chargesReady = org.stripeConnectChargesEnabled && Boolean(org.stripeConnectAccountId);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Shop</h1><p className="text-sm text-zinc-500">Sell your inventory online.</p></div>
        <Link href="/shop/orders" className="rounded border px-4 py-2 text-sm">Orders</Link>
      </div>
      {query.error === "slug" && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">Use a unique shop URL with 3–40 lowercase letters, numbers, or hyphens.</p>}
      {query.error === "fulfillment" && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">Enable shipping or pickup before opening the shop.</p>}
      {query.saved && <p className="rounded bg-green-50 p-3 text-green-800">Shop settings saved.</p>}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Shop setup</h2>
        {manager ? (
          <form action={saveShopSettings} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Shop URL slug
              <input name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9\-]+" defaultValue={slug} className="rounded border bg-transparent px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">Tagline
              <input name="tagline" maxLength={180} defaultValue={shop?.tagline ?? ""} className="rounded border bg-transparent px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={shop?.enabled ?? false} /> Open shop</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shipEnabled" defaultChecked={shop?.shipEnabled ?? true} /> Offer shipping</label>
            <label className="grid gap-1 text-sm">Flat shipping rate
              <input name="shipFlatRate" type="number" min="0" step="0.01" defaultValue={shop?.shipFlatRate ?? 0} className="rounded border bg-transparent px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pickupEnabled" defaultChecked={shop?.pickupEnabled ?? false} /> Offer pickup</label>
            <label className="grid gap-1 text-sm sm:col-span-2">Pickup note
              <input name="pickupNote" maxLength={240} defaultValue={shop?.pickupNote ?? ""} className="rounded border bg-transparent px-3 py-2" />
            </label>
            <div className="sm:col-span-2"><button className="rounded bg-blue-700 px-4 py-2 font-medium text-white">Save shop</button></div>
          </form>
        ) : (
          <p>Shop URL: <a className="text-blue-700 underline" href={shopUrl}>{shopUrl}</a></p>
        )}
      </section>
      <section id="connect" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Payments</h2>
        {chargesReady ? <p className="mt-2 text-sm text-green-700">Connected payments are enabled.</p> : <p className="mt-2 text-sm">Connect Stripe to accept card payments. <Link href="/billing#connect" className="text-blue-700 underline">Set up payments in Billing</Link>.</p>}
      </section>
      {shop && (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-lg font-semibold">Share your shop</h2>
          <p className="mb-3 break-all text-sm">{shopUrl}</p>
          <ShopShareTools url={shopUrl} qr={shareQr} filename={`${slug}-shop-qr.png`} />
        </section>
      )}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-lg font-semibold">Inventory items</h2>
        {!inventoryEnabled ? (
          <p className="text-sm text-zinc-600">Inventory is off. Choose an account plan that includes Inventory in <Link href="/billing#plan" className="text-blue-700 underline">Billing settings</Link>.</p>
        ) : parts.length === 0 ? (
          <p className="text-sm text-zinc-600">Add items in <Link href="/inventory" className="text-blue-700 underline">Inventory</Link> to sell them here.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {await Promise.all(parts.map(async (part) => {
              const itemUrl = `${shopUrl}/${encodeURIComponent(part.id)}`;
              const qr = await QRCode.toDataURL(itemUrl, { width: 180, margin: 1 });
              return (
                <article key={part.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">{part.name}</h3>
                    <p className="text-sm text-zinc-500">{(part.unitPrice ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })} · {part.qtyOnHand} in stock · {part.photos.length} photos</p>
                    {manager && <ShopPhotoManager partId={part.id} photos={part.photos} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {manager && <form action={setShopListed.bind(null, part.id, !part.shopListed)}><button className={`rounded px-3 py-2 text-sm ${part.shopListed ? "border" : "bg-blue-700 text-white"}`}>{part.shopListed ? "In shop — remove" : "List in shop"}</button></form>}
                    {part.shopListed && <ShopShareTools url={itemUrl} qr={qr} filename={`${slug}-${part.id}.png`} />}
                  </div>
                </article>
              );
            }))}
          </div>
        )}
      </section>
      <footer className="text-sm text-zinc-500">Descriptions are edited from the existing <Link href="/inventory" className="text-blue-700 underline">inventory item form</Link>.</footer>
    </main>
  );
}
