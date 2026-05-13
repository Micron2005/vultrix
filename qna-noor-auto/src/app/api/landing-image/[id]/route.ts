import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const block = await db.landingBlock.findUnique({
    where: { id },
    select: { imageData: true },
  });

  if (!block?.imageData) {
    return new Response("Not found", { status: 404 });
  }

  const match = block.imageData.match(
    /^data:(image\/\w+);base64,(.+)$/,
  );
  if (!match) {
    return new Response("Bad image data", { status: 500 });
  }

  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  return new Response(bytes, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
