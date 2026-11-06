import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PublicShopPage from "./StorefrontPage";
import ScanPartPage from "../ScanPartPage";

export default async function ShopOrPartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const shop = await db.shop.findUnique({
    where: { slug: id },
    select: { enabled: true },
  });
  if (shop?.enabled) {
    return PublicShopPage({ params: Promise.resolve({ slug: id }) });
  }
  if (shop) notFound();
  return ScanPartPage({ params: Promise.resolve({ id }), searchParams });
}
