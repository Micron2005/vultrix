import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { shopDisplayName } from "@/lib/shop";
import { formatMoney } from "@/lib/utils";
import { ShopCartLink } from "../StorefrontClient";

export default async function PublicShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shop = await db.shop.findUnique({
    where: { slug },
    include: { organization: { select: { name: true, id: true } } },
  });
  if (!shop?.enabled) notFound();
  const products = await db.part.findMany({
    where: {
      orgId: shop.orgId,
      shopListed: true,
      archived: false,
      unitPrice: { gt: 0 },
      photos: { some: {} },
    },
    orderBy: { name: "asc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
    },
  });
  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold sm:text-3xl">{shopDisplayName(shop, shop.organization.name)}</h1>
            {shop.tagline && <p className="mt-2 text-zinc-600 dark:text-zinc-300">{shop.tagline}</p>}
          </div>
          <ShopCartLink slug={slug} />
        </header>
        {products.length ? (
          <div className="grid grid-cols-2 gap-3 py-7 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {products.map((part) => (
              <Link
                key={part.id}
                href={`/store/${encodeURIComponent(slug)}/${encodeURIComponent(part.id)}`}
                className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {part.photos[0] ? (
                  <img src={`/api/shop/photo/${part.photos[0].id}`} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="grid aspect-square place-items-center bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-800">No photo</div>
                )}
                <div className="space-y-1 p-3 sm:p-4">
                  <h2 className="break-words font-semibold">{part.name}</h2>
                  <p className="font-medium">{formatMoney(part.unitPrice)}</p>
                  {part.qtyOnHand <= 0 && <span className="inline-block rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Sold out</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-zinc-500">No items are available right now.</p>
        )}
        <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Powered by Vultrix
        </footer>
      </div>
    </main>
  );
}
