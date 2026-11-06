import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { AddToCartButton, ProductGallery, ShopCartLink } from "../../StorefrontClient";

export default async function PublicShopProductPage({
  params,
}: {
  params: Promise<{ slug: string; partId: string }>;
}) {
  const { slug, partId } = await params;
  const shop = await db.shop.findUnique({ where: { slug } });
  if (!shop?.enabled) notFound();
  const part = await db.part.findFirst({
    where: {
      id: partId,
      orgId: shop.orgId,
      shopListed: true,
      archived: false,
      unitPrice: { gt: 0 },
      photos: { some: {} },
    },
    include: { photos: { orderBy: { position: "asc" }, select: { id: true } } },
  });
  if (!part) notFound();
  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <Link href={`/store/${encodeURIComponent(slug)}`} className="text-sm text-blue-700 underline dark:text-blue-300">Back to shop</Link>
          <ShopCartLink slug={slug} />
        </header>
        <div className="grid gap-7 lg:grid-cols-2">
          <ProductGallery name={part.name} photos={part.photos.map((photo) => `/api/shop/photo/${photo.id}`)} />
          <section className="min-w-0 space-y-4">
            <h1 className="break-words text-3xl font-bold">{part.name}</h1>
            <p className="text-2xl font-semibold">{formatMoney(part.unitPrice)}</p>
            {part.description && <p className="whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">{part.description}</p>}
            {part.qtyOnHand <= 0 ? (
              <p className="font-medium text-zinc-500">Sold out</p>
            ) : (
              <>
                <p className="text-sm text-zinc-500">{part.qtyOnHand} in stock</p>
                <AddToCartButton slug={slug} partId={part.id} stock={part.qtyOnHand} />
              </>
            )}
          </section>
        </div>
        <footer className="mt-12 border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">Powered by Vultrix</footer>
      </div>
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; partId: string }>;
}): Promise<Metadata> {
  const { slug, partId } = await params;
  const shop = await db.shop.findUnique({ where: { slug } });
  if (!shop?.enabled) return { title: "Product" };
  const part = await db.part.findFirst({
    where: {
      id: partId,
      orgId: shop.orgId,
      shopListed: true,
      archived: false,
      unitPrice: { gt: 0 },
      photos: { some: {} },
    },
    select: { name: true },
  });
  return { title: part?.name ?? "Product" };
}
