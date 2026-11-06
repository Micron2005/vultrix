import type { Metadata } from "next";
import { db } from "@/lib/db";
import { shopDisplayName } from "@/lib/shop";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      name: true,
      organization: { select: { name: true } },
    },
  });
  if (!shop) return { title: "Shop" };
  const displayName = shopDisplayName(shop, shop.organization.name);
  return {
    title: { default: displayName, template: `%s | ${displayName}` },
  };
}

export default function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
