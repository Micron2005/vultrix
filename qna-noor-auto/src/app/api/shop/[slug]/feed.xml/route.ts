import { db } from "@/lib/db";
import { baseUrl } from "@/lib/requestUrl";
import { buildProductFeedXml } from "@/lib/shop";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      orgId: true,
      enabled: true,
      shipEnabled: true,
      shipFlatRate: true,
      organization: { select: { name: true } },
    },
  });
  if (!shop?.enabled) return new Response("Not found", { status: 404 });

  const parts = await db.part.findMany({
    where: {
      orgId: shop.orgId,
      shopListed: true,
      archived: false,
      unitPrice: { gt: 0 },
      photos: { some: {} },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      unitPrice: true,
      qtyOnHand: true,
      category: true,
      photos: {
        orderBy: { position: "asc" },
        take: 6,
        select: { id: true },
      },
    },
  });
  const feed = buildProductFeedXml(
    {
      slug: shop.slug,
      name: shop.name,
      shipEnabled: shop.shipEnabled,
      shipFlatRate: shop.shipFlatRate,
    },
    shop.organization.name,
    parts.map((part) => ({
      ...part,
      photoIds: part.photos.map((photo) => photo.id),
    })),
    baseUrl(req),
  );

  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
