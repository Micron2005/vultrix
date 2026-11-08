import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import { canViewFinancials } from "@/lib/permissions";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  aggregateSalesByChannel,
  shopDisplayName,
  suggestedShopSlug,
} from "@/lib/shop";
import { localCalendarDay } from "@/lib/timezone";
import { formatMoney } from "@/lib/utils";
import {
  ShopFeedCopyButton,
  ShopItemActions,
  ShopPhotoManager,
  ShopShareTools,
} from "./ShopTools";
import { saveShopSettings, setShopListed } from "./actions";

export default async function ShopManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; range?: string }>;
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
  const canViewSales =
    canViewFinancials(user.role) && enabledFeatureSet(org).has("financials");
  const defaultSaleDate = canViewSales
    ? localCalendarDay(new Date(), await orgTimeZone(user.orgId))
    : "";
  const parts = inventoryEnabled
    ? await db.part.findMany({
        where: { orgId: user.orgId, archived: false },
        include: { photos: { orderBy: { position: "asc" }, select: { id: true, position: true } } },
        orderBy: { name: "asc" },
      })
    : [];
  const hiddenListedItems = parts.filter(
    (part) =>
      part.shopListed && ((part.unitPrice ?? 0) <= 0 || part.photos.length === 0),
  ).length;
  const headersList = await headers();
  const origin = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("x-forwarded-host") ?? headersList.get("host")}`;
  const slug = shop?.slug ?? suggestedShopSlug(org.name);
  const shopUrl = `${origin}/store/${encodeURIComponent(slug)}`;
  const feedUrl = `${origin}/api/shop/${encodeURIComponent(slug)}/feed.xml`;
  const shareQr = await QRCode.toDataURL(shopUrl, { width: 280, margin: 1 });
  const chargesReady = org.stripeConnectChargesEnabled && Boolean(org.stripeConnectAccountId);
  const range =
    query.range === "90d" || query.range === "all" ? query.range : "30d";
  const now = new Date();
  const sales = canViewSales
    ? await db.sale.findMany({
        where: {
          orgId: user.orgId,
          ...(range === "all"
            ? {}
            : {
                soldAt: {
                  gte: new Date(
                    now.getTime() -
                      (range === "90d" ? 90 : 30) * 24 * 60 * 60 * 1000,
                  ),
                  lte: now,
                },
              }),
        },
        select: { channel: true, quantity: true, unitPrice: true },
      })
    : [];
  const salesByChannel = aggregateSalesByChannel(sales);
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
            <label className="grid gap-1 text-sm sm:col-span-2">Shop name
              <input name="name" maxLength={80} defaultValue={shop?.name ?? ""} placeholder={org.name} className="rounded border bg-transparent px-3 py-2" />
              <span className="text-xs text-zinc-500">Shown to buyers instead of your account name.</span>
            </label>
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
          {hiddenListedItems > 0 && (
            <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
              {hiddenListedItems} listed {hiddenListedItems === 1 ? "item is" : "items are"} hidden from buyers until they have a price and photo.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ShopShareTools
              url={shopUrl}
              qr={shareQr}
              filename={`${slug}-shop-qr.png`}
              title={shopDisplayName(shop, org.name)}
            />
          </div>
        </section>
      )}
      {shop && (
        <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold">Sell on other sites</h2>
            <p className="mt-2 break-all text-sm">{feedUrl}</p>
            <div className="mt-2">
              <ShopFeedCopyButton url={feedUrl} />
            </div>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              <strong>Facebook &amp; Instagram Shop:</strong> In Meta Commerce
              Manager, go to Catalog → Data sources → Data feed → Scheduled
              feed, paste the URL, and choose hourly or daily updates.
            </li>
            <li>
              <strong>Google:</strong> In Merchant Center, go to Products → Add
              products from a file → “Add a link to a file,” then paste the URL.
            </li>
          </ol>
          <p className="text-sm">
            Items need a photo and price to appear in the feed.
          </p>
          <p className="text-sm">
            Etsy, markets, in person: log those sales below so your stock stays
            right.
          </p>
        </section>
      )}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-lg font-semibold">Inventory items</h2>
        {!inventoryEnabled ? (
          <p className="text-sm text-zinc-600">Inventory is off. Change your account type in <Link href="/billing#plan" className="text-blue-700 underline">Plan and account type</Link>.</p>
        ) : parts.length === 0 ? (
          <p className="text-sm text-zinc-600">Add items in <Link href="/inventory" className="text-blue-700 underline">Inventory</Link> to sell them here.</p>
        ) : (
          <div className="space-y-4">
            {await Promise.all(parts.map(async (part) => {
              const itemUrl = `${shopUrl}/${encodeURIComponent(part.id)}`;
              const qr = await QRCode.toDataURL(itemUrl, { width: 180, margin: 1 });
              const missingPrice = part.unitPrice == null || part.unitPrice <= 0;
              const missingPhoto = part.photos.length === 0;
              const missingRequirements = missingPrice && missingPhoto
                ? "add a price and a photo"
                : missingPrice
                  ? "add a price"
                  : "add a photo";
              return (
                <article key={part.id} className="min-w-0 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <header className="min-w-0">
                    <h3 className="break-words font-medium">{part.name}</h3>
                    <p className="text-sm text-zinc-500">{(part.unitPrice ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })} · {part.qtyOnHand} in stock · {part.photos.length} photos</p>
                  </header>
                  {manager && <ShopPhotoManager partId={part.id} photos={part.photos} />}
                  {part.shopListed && (missingPrice || missingPhoto) && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      <p>Buyers can&apos;t see this yet: {missingRequirements}.</p>
                      <Link href={`/inventory/${encodeURIComponent(part.id)}/edit`} className="mt-1 inline-block font-medium underline">Edit price</Link>
                    </div>
                  )}
                  <ShopItemActions
                    partId={part.id}
                    unitPrice={part.unitPrice}
                    defaultSoldAt={defaultSaleDate}
                    canLogSale={part.shopListed && canViewSales}
                  >
                    {manager && (
                      <form className="flex" action={setShopListed.bind(null, part.id, !part.shopListed)}>
                        <button className={`rounded px-3 py-2 text-sm ${part.shopListed ? "border" : "bg-blue-700 text-white"}`}>
                          {part.shopListed ? "In shop — remove" : "Add to shop"}
                        </button>
                      </form>
                    )}
                    {part.shopListed && (
                      <ShopShareTools
                        url={itemUrl}
                        qr={qr}
                        filename={`${slug}-${part.id}.png`}
                        title={part.name}
                      />
                    )}
                  </ShopItemActions>
                </article>
              );
            }))}
          </div>
        )}
      </section>
      {canViewSales && (
        <section
          id="sales-by-channel"
          className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Sales by channel</h2>
            <nav aria-label="Sales by channel date range" className="flex gap-2">
              {[
                { value: "30d", label: "30 days" },
                { value: "90d", label: "90 days" },
                { value: "all", label: "All time" },
              ].map((option) => (
                <Link
                  key={option.value}
                  href={`/shop?range=${option.value}`}
                  aria-current={range === option.value ? "page" : undefined}
                  className={`rounded border px-3 py-2 text-sm ${
                    range === option.value
                      ? "border-blue-700 bg-blue-50 dark:bg-blue-950"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
          {salesByChannel.length === 0 ? (
            <p className="text-sm text-zinc-600">No sales in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2 text-right">Sales</th>
                    <th className="px-3 py-2 text-right">Items sold</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {salesByChannel.map((summary, index) => (
                    <tr
                      key={summary.channel}
                      className={
                        index === 0
                          ? "bg-blue-50 dark:bg-blue-950/40"
                          : undefined
                      }
                    >
                      <td className="px-3 py-2 font-medium">
                        {summary.channel}
                        {index === 0 && (
                          <span className="ml-2 rounded-full bg-blue-700 px-2 py-1 text-xs text-white">
                            Best place to sell
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {summary.count.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {summary.itemsSold.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(summary.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <footer className="text-sm text-zinc-500">Descriptions are edited from the existing <Link href="/inventory" className="text-blue-700 underline">inventory item form</Link>.</footer>
    </main>
  );
}
