import { db } from "@/lib/db";

export type InventoryPartInput = {
  partNumber?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  location?: string | null;
  source?: string | null;
  costPrice?: number | null;
  unitPrice?: number | null;
  reorderLevel?: number;
  fitsMake?: string | null;
  fitsModel?: string | null;
  fitsYearMin?: number | null;
  fitsYearMax?: number | null;
  notes?: string | null;
  archived?: boolean;
};

export async function createInventoryPart(
  orgId: string,
  input: InventoryPartInput,
  openingQuantity = 0,
) {
  return db.$transaction(async (tx) => {
    const part = await tx.part.create({
      data: {
        ...input,
        name: input.name.trim(),
        qtyOnHand: 0,
        orgId,
      },
    });
    if (openingQuantity !== 0) {
      await tx.part.update({
        where: { id: part.id },
        data: { qtyOnHand: openingQuantity },
      });
      await tx.stockMove.create({
        data: {
          partId: part.id,
          delta: openingQuantity,
          reason: "INITIAL",
          note: "Opening balance",
        },
      });
    }
    return tx.part.findUniqueOrThrow({ where: { id: part.id } });
  });
}

export async function adjustInventoryStock(
  orgId: string,
  partId: string,
  delta: number,
  reason = "ADJUST",
  note?: string | null,
) {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("Stock delta must be a non-zero number.");
  }
  const safeReason =
    reason === "RECEIVE" || reason === "ADJUST" ? reason : "ADJUST";

  return db.$transaction(async (tx) => {
    const part = await tx.part.findFirst({
      where: { id: partId, orgId },
      select: { id: true },
    });
    if (!part) throw new Error("Inventory part not found.");

    await tx.part.update({
      where: { id: partId },
      data: { qtyOnHand: { increment: delta } },
    });
    await tx.stockMove.create({
      data: {
        partId,
        delta,
        reason: safeReason,
        note: note?.trim() || null,
      },
    });
    return tx.part.findUniqueOrThrow({ where: { id: partId } });
  });
}
