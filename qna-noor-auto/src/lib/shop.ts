import { db, dbBase } from "./db";

const DEFAULTS: Record<string, string> = {
  shopName: "",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  defaultLaborRate: "150",
  defaultTaxRate: "8.25",
  remindAppointmentsEnabled: "false",
  remindAppointmentsHoursBefore: "24",
  remindPastDueEnabled: "false",
  remindPastDueDays: "30",
  remindServiceDueEnabled: "false",
  reminderSendHour: "8",
  weeklyReviewEmailEnabled: "false",
};

export async function getSetting(orgId: string, key: string): Promise<string> {
  const row = await db.shopSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  if (row) return row.value;
  // Default the shop name to the organization's own name (not a hardcoded
  // sample shop) so a brand-new business sees their name until they customize.
  if (key === "shopName") {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (org?.name) return org.name;
  }
  return DEFAULTS[key] ?? "";
}

export async function getAllSettings(
  orgId: string,
): Promise<Record<string, string>> {
  const [rows, org] = await Promise.all([
    db.shopSetting.findMany({ where: { orgId } }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
  ]);
  const out: Record<string, string> = { ...DEFAULTS };
  // Per-org default: show their own business name as the shop name until an
  // explicit shopName setting is saved below.
  if (org?.name) out.shopName = org.name;
  for (const r of rows) out[r.key] = r.value; // explicit saved settings win
  return out;
}

export async function setSetting(orgId: string, key: string, value: string) {
  await db.shopSetting.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, value },
    update: { value },
  });
}

export async function getNextRoNumber(orgId: string): Promise<number> {
  // Use dbBase (no soft-delete filter) so the next number also clears
  // trashed/soft-deleted repair orders. The (orgId, roNumber) unique constraint
  // spans deleted rows too, so ignoring them here would reuse a number a
  // trashed ticket still holds and crash the create with a unique violation.
  const last = await dbBase.repairOrder.findFirst({
    where: { orgId },
    orderBy: { roNumber: "desc" },
    select: { roNumber: true },
  });
  return (last?.roNumber ?? 1000) + 1;
}
