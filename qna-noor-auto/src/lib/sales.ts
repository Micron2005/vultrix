import { db } from "@/lib/db";
import { notifyLowStockIfCrossed } from "@/lib/lowStock";

type SalesTransaction = Pick<typeof db, "part" | "stockMove" | "sale" | "income">;

export type SaleInput = {
  soldAt: Date;
  partId?: string | null;
  shopOrderId?: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
  channel?: string | null;
  note?: string | null;
};

export type SellingProduct = {
  itemName: string;
  units: number;
  revenue: number;
};

export type SaleStockAlert = {
  partId: string;
  qtyBefore: number;
  qtyAfter: number;
};

export async function loadTopSellingProducts(
  orgId: string,
  range: { from: Date; to: Date },
  limit = 3,
): Promise<SellingProduct[]> {
  const sales = await db.sale.findMany({
    where: { orgId, soldAt: { gte: range.from, lte: range.to } },
    select: { itemName: true, quantity: true, unitPrice: true },
  });
  const totals = new Map<string, SellingProduct>();
  for (const sale of sales) {
    const current = totals.get(sale.itemName) ?? {
      itemName: sale.itemName,
      units: 0,
      revenue: 0,
    };
    current.units += sale.quantity;
    current.revenue += sale.quantity * sale.unitPrice;
    totals.set(sale.itemName, current);
  }
  return [...totals.values()]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, limit);
}

function saleNote(itemName: string): string {
  return `Sale: ${itemName}`;
}

async function getPartForOrg(
  tx: SalesTransaction,
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
  tx: SalesTransaction,
  partId: string,
  delta: number,
  itemName: string,
) : Promise<{ qtyBefore: number; qtyAfter: number } | null> {
  if (delta === 0) return null;
  const part = await tx.part.findUnique({
    where: { id: partId },
    select: { qtyOnHand: true },
  });
  if (!part) throw new Error("Inventory item not found.");
  const updatedPart = await tx.part.update({
    where: { id: partId },
    data: { qtyOnHand: { increment: delta } },
    select: { qtyOnHand: true },
  });
  await tx.stockMove.create({
    data: {
      partId,
      delta,
      reason: "SALE",
      note: saleNote(itemName),
    },
  });
  return { qtyBefore: part.qtyOnHand, qtyAfter: updatedPart.qtyOnHand };
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
  const result = await db.$transaction((tx) => createSaleTx(tx, orgId, input));
  await notifySaleStockAlerts(result.stockAlerts);
  return result.sale;
}

export async function createSaleTx(
  tx: SalesTransaction,
  orgId: string,
  input: SaleInput,
): Promise<{ sale: Awaited<ReturnType<typeof db.sale.create>>; stockAlerts: SaleStockAlert[] }> {
  assertSaleInput(input);
  const stockAlerts: SaleStockAlert[] = [];
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
      shopOrderId: input.shopOrderId ?? null,
      itemName,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      unitCost,
      channel: input.channel?.trim() || null,
      note: input.note?.trim() || null,
    },
  });
  if (part) {
    const stockMove = await writeStockMove(
      tx,
      part.id,
      -input.quantity,
      itemName,
    );
    if (stockMove) {
      stockAlerts.push({ partId: part.id, ...stockMove });
    }
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
  const linkedSale = await tx.sale.update({
    where: { id: sale.id },
    data: { incomeId: income.id },
  });
  return { sale: linkedSale, stockAlerts };
}

async function notifySaleStockAlerts(alerts: SaleStockAlert[]): Promise<void> {
  for (const alert of alerts) {
    await notifyLowStockIfCrossed(alert.partId, alert.qtyBefore);
  }
}

export async function updateSale(
  orgId: string,
  id: string,
  input: SaleInput,
) {
  assertSaleInput(input);
  const stockAlerts: SaleStockAlert[] = [];
  const sale = await db.$transaction(async (tx) => {
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
      const stockMove = await writeStockMove(
        tx,
        oldPart.id,
        existing.quantity - input.quantity,
        itemName,
      );
      if (stockMove && existing.quantity < input.quantity) {
        stockAlerts.push({ partId: oldPart.id, ...stockMove });
      }
    } else {
      if (oldPart) {
        await writeStockMove(tx, oldPart.id, existing.quantity, existing.itemName);
      }
      if (newPart) {
        const stockMove = await writeStockMove(
          tx,
          newPart.id,
          -input.quantity,
          itemName,
        );
        if (stockMove) {
          stockAlerts.push({ partId: newPart.id, ...stockMove });
        }
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
  await notifySaleStockAlerts(stockAlerts);
  return sale;
}

export async function deleteSale(orgId: string, id: string) {
  return db.$transaction(async (tx) => {
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
