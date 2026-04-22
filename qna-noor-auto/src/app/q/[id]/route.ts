import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifyPartToken } from "@/lib/scanTokens";

export const dynamic = "force-dynamic";

/**
 * Quick-scan endpoint. Scans from a QR sticker hit this route, it
 * automatically subtracts 1 from stock, logs a StockMove, then redirects
 * to `/q/<id>/done` so the tech sees confirmation. No login required —
 * the `k` query param is verified against the server-side signing secret.
 *
 * A short-lived cookie (`_qscan_<id>`) stops the page from double-subtracting
 * if the phone / browser reloads the URL within 10 seconds.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const k = req.nextUrl.searchParams.get("k") ?? "";

  if (!verifyPartToken(id, k)) {
    return NextResponse.redirect(new URL(`/s/${id}`, req.url));
  }

  const part = await db.part.findUnique({
    where: { id },
    select: { id: true, qtyOnHand: true },
  });
  if (!part) {
    return NextResponse.redirect(new URL(`/s/${id}`, req.url));
  }

  const cookieKey = `_qscan_${id}`;
  const recent = req.cookies.get(cookieKey);

  let newQty = part.qtyOnHand;
  let moveId: string | null = null;

  if (!recent) {
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.part.update({
        where: { id },
        data: { qtyOnHand: { increment: -1 } },
        select: { qtyOnHand: true },
      });
      const move = await tx.stockMove.create({
        data: {
          partId: id,
          delta: -1,
          reason: "ADJUST",
          note: "Scan: used 1 (quick)",
        },
        select: { id: true },
      });
      return { qty: updated.qtyOnHand, moveId: move.id };
    });
    newQty = result.qty;
    moveId = result.moveId;

    revalidatePath(`/inventory/${id}`);
    revalidatePath("/inventory");
    revalidatePath(`/s/${id}`);
    revalidatePath("/");
  }

  const doneUrl = new URL(`/q/${id}/done`, req.url);
  doneUrl.searchParams.set("qty", String(newQty));
  if (moveId) doneUrl.searchParams.set("m", moveId);
  if (recent) doneUrl.searchParams.set("dup", "1");

  const res = NextResponse.redirect(doneUrl);
  if (!recent) {
    res.cookies.set(cookieKey, "1", {
      maxAge: 10,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return res;
}
