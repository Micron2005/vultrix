import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CartPageClient } from "../../StorefrontClient";

export const metadata: Metadata = { title: "Your cart" };

export default async function PublicShopCartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shop = await db.shop.findUnique({
    where: { slug },
    include: { organization: { select: { stripeConnectChargesEnabled: true, stripeConnectAccountId: true } } },
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
    include: { photos: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link href={`/store/${encodeURIComponent(slug)}`} className="text-sm text-blue-700 underline dark:text-blue-300">← Continue shopping</Link>
        <h1 className="my-5 text-3xl font-bold">Your cart</h1>
        <CartPageClient
          slug={slug}
          products={products.map((part) => ({
            id: part.id,
            name: part.name,
            price: part.unitPrice ?? 0,
            qtyOnHand: part.qtyOnHand,
            photoId: part.photos[0]?.id ?? null,
            shopListed: part.shopListed,
            archived: part.archived,
          }))}
          shipEnabled={shop.shipEnabled}
          shipFlatRate={shop.shipFlatRate}
          pickupEnabled={shop.pickupEnabled}
          pickupNote={shop.pickupNote}
          chargesEnabled={shop.organization.stripeConnectChargesEnabled && Boolean(shop.organization.stripeConnectAccountId)}
        />
        <footer className="mt-12 border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">Powered by Vultrix</footer>
      </div>
    </main>
  );
}
