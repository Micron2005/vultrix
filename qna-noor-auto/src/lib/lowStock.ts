import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { notify } from "@/lib/notifications";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";

export async function notifyLowStockIfCrossed(
  partId: string,
  qtyBefore: number,
): Promise<void> {
  const part = await db.part.findUnique({
    where: { id: partId },
    select: {
      id: true,
      orgId: true,
      name: true,
      qtyOnHand: true,
      reorderLevel: true,
      archived: true,
    },
  });
  if (
    !part ||
    part.archived ||
    part.reorderLevel <= 0 ||
    qtyBefore <= part.reorderLevel ||
    part.qtyOnHand > part.reorderLevel
  ) {
    return;
  }
  await notify({
    orgId: part.orgId,
    userId: null,
    kind: "low_stock",
    title: part.qtyOnHand <= 0 ? `Out of stock: ${part.name}` : `Low stock: ${part.name}`,
    body: `${part.qtyOnHand} left (reorder at ${part.reorderLevel})`,
    href: `/inventory/${part.id}`,
    dedupeKey: part.id,
  });
}

export async function createLowStockNotifications(
  orgId: string,
): Promise<number> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true },
  });
  if (!enabledFeatureSet(organization ?? {}).has("inventory")) return 0;

  const parts = await db.part.findMany({
    where: {
      orgId,
      archived: false,
      reorderLevel: { gt: 0 },
    },
    select: { id: true, name: true, qtyOnHand: true, reorderLevel: true },
  });
  const lowStockParts = parts.filter(
    (part) => part.qtyOnHand <= part.reorderLevel,
  );
  if (!lowStockParts.length) return 0;

  const timezone = await orgTimeZone(orgId);
  const today = localCalendarDay(new Date(), timezone);
  await notify({
    orgId,
    userId: null,
    kind: "low_stock",
    title: `${lowStockParts.length} part${
      lowStockParts.length === 1 ? "" : "s"
    } low on stock`,
    body: `${lowStockParts
      .slice(0, 3)
      .map((part) => part.name)
      .join(", ")}${lowStockParts.length > 3 ? "…" : ""}`,
    href: "/inventory?filter=low",
    dedupeKey: `${today}:low-stock`,
  });
  return lowStockParts.length;
}
