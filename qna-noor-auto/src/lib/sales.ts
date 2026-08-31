import { dbBase } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type SaleInput = {
  soldAt: Date;
  partId?: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
  channel?: string | null;
  note?: string | null;
};

function saleNote(itemName: string): string {
  return `Sale: ${itemName}`;
}

async function getPartForOrg(
  tx: Prisma.TransactionClient,
  orgId: string,
  partId: string,
) {
  const part = await tx.part.findFirst({
    where: { id: partId, orgId },
    select: { id: true, name: true, costPrice: true },
  });
  if (!part) throw new Error("Inventory item not found.");
  return part;
}

async function writeStockMove(
  tx: Prisma.TransactionClient,
  partId: string,
  delta: number,
  itemName: string,
) {
  if (delta === 0) return;
  await tx.part.update({
    where: { id: partId },
    data: { qtyOnHand: { increment: delta } },
  });
  await tx.stockMove.create({
    data: {
      partId,
      delta,
      reason: "SALE",
      note: saleNote(itemName),
    },
  });
}

function assertSaleInput(input: SaleInput): void {
  if (!input.itemName.trim()) throw new Error("Item name is required.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    throw new Error("Price must be zero or greater.");
  }
  if (
    input.unitCost != null &&
    (!Number.isFinite(input.unitCost) || input.unitCost < 0)
  ) {
    throw new Error("Cost must be zero or greater.");
  }
  if (!(input.soldAt instanceof Date) || Number.isNaN(input.soldAt.getTime())) {
    throw new Error("Sale date is invalid.");
  }
}

export async function createSale(orgId: string, input: SaleInput) {
  assertSaleInput(input);
  return dbBase.$transaction(async (tx) => {
    const part = input.partId
      ? await getPartForOrg(tx, orgId, input.partId)
      : null;
    const itemName = part?.name ?? input.itemName.trim();
    const unitCost = input.unitCost ?? part?.costPrice ?? null;
    const sale = await tx.sale.create({
      data: {
        orgId,
        soldAt: input.soldAt,
        partId: part?.id ?? null,
        itemName,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        unitCost,
        channel: input.channel?.trim() || null,
        note: input.note?.trim() || null,
      },
    });
    if (part) {
      await writeStockMove(tx, part.id, -input.quantity, itemName);
    }
    const income = await tx.income.create({
      data: {
        orgId,
        receivedAt: input.soldAt,
        amount: input.quantity * input.unitPrice,
        source: itemName,
        frequency: "ONE_TIME",
        note: input.note?.trim() || null,
      },
    });
    return tx.sale.update({
      where: { id: sale.id },
      data: { incomeId: income.id },
    });
  });
}

export async function updateSale(
  orgId: string,
  id: string,
  input: SaleInput,
) {
  assertSaleInput(input);
  return dbBase.$transaction(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        partId: true,
        itemName: true,
        quantity: true,
        incomeId: true,
      },
    });
    if (!existing) throw new Error("Sale not found.");

    const oldPart = existing.partId
      ? await getPartForOrg(tx, orgId, existing.partId)
      : null;
    const newPart = input.partId
      ? await getPartForOrg(tx, orgId, input.partId)
      : null;
    const itemName = newPart?.name ?? input.itemName.trim();
    const unitCost = input.unitCost ?? newPart?.costPrice ?? null;

    if (oldPart && newPart && oldPart.id === newPart.id) {
      await writeStockMove(
        tx,
        oldPart.id,
        existing.quantity - input.quantity,
        itemName,
      );
    } else {
      if (oldPart) {
        await writeStockMove(tx, oldPart.id, existing.quantity, existing.itemName);
      }
      if (newPart) {
        await writeStockMove(tx, newPart.id, -input.quantity, itemName);
      }
    }

    const sale = await tx.sale.update({
      where: { id: existing.id },
      data: {
        soldAt: input.soldAt,
        partId: newPart?.id ?? null,
        itemName,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        unitCost,
        channel: input.channel?.trim() || null,
        note: input.note?.trim() || null,
      },
    });
    if (existing.incomeId) {
      await tx.income.update({
        where: { id: existing.incomeId },
        data: {
          receivedAt: input.soldAt,
          amount: input.quantity * input.unitPrice,
          source: itemName,
          note: input.note?.trim() || null,
        },
      });
    } else {
      const income = await tx.income.create({
        data: {
          orgId,
          receivedAt: input.soldAt,
          amount: input.quantity * input.unitPrice,
          source: itemName,
          frequency: "ONE_TIME",
          note: input.note?.trim() || null,
        },
      });
      return tx.sale.update({
        where: { id: sale.id },
        data: { incomeId: income.id },
      });
    }
    return sale;
  });
}

export async function deleteSale(orgId: string, id: string) {
  return dbBase.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        partId: true,
        itemName: true,
        quantity: true,
        incomeId: true,
      },
    });
    if (!sale) throw new Error("Sale not found.");
    if (sale.partId) {
      const part = await getPartForOrg(tx, orgId, sale.partId);
      await writeStockMove(tx, part.id, sale.quantity, sale.itemName);
    }
    if (sale.incomeId) {
      await tx.income.deleteMany({
        where: { id: sale.incomeId, orgId },
      });
    }
    return tx.sale.delete({ where: { id: sale.id } });
  });
}
