import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const photo = await db.productPhoto.findUnique({
    where: { id },
    select: {
      dataUrl: true,
      part: {
        select: { orgId: true, shopListed: true, archived: true },
      },
    },
  });
  if (!photo?.part?.shopListed || photo.part.archived) {
    return new Response("Not found", { status: 404 });
  }
  const shop = await db.shop.findUnique({
    where: { orgId: photo.part.orgId },
    select: { enabled: true },
  });
  if (!shop?.enabled) return new Response("Not found", { status: 404 });

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(photo.dataUrl);
  if (!match || match[1].length > 4_000_000) {
    return new Response("Not found", { status: 404 });
  }
  const image = Buffer.from(match[1], "base64");
  return new Response(image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
