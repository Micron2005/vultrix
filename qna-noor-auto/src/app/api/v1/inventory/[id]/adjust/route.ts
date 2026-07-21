import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  badRequest,
  notFound,
  validationError,
  withApiKey,
} from "@/lib/apiV1";

const AdjustSchema = z.object({
  delta: z.number().finite().refine((value) => value !== 0, {
    message: "delta must not be zero",
  }),
  reason: z.string().trim().min(1),
  note: z.string().trim().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiKey(request, async (orgId) => {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }

    let data: z.infer<typeof AdjustSchema>;
    try {
      data = AdjustSchema.parse(body);
    } catch (error) {
      return validationError(error);
    }

    const part = await db.part.findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!part) return notFound("Inventory item not found");

    const reason =
      data.reason === "RECEIVE" || data.reason === "ADJUST"
        ? data.reason
        : "ADJUST";
    await db.part.update({
      where: { id },
      data: { qtyOnHand: { increment: data.delta } },
    });
    const move = await db.stockMove.create({
      data: {
        partId: id,
        delta: data.delta,
        reason,
        note: data.note?.trim() || null,
      },
    });
    const updated = await db.part.findFirst({
      where: { id, orgId },
      select: { id: true, qtyOnHand: true },
    });
    return NextResponse.json({
      inventory: updated,
      stockMove: { id: move.id, delta: move.delta, reason: move.reason },
    });
  });
}
