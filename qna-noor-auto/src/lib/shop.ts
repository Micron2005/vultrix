import { db } from "./db";

const DEFAULTS: Record<string, string> = {
  shopName: "QNA / Noor Auto Repair",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  defaultLaborRate: "150",
  defaultTaxRate: "8.25",
};

export async function getSetting(orgId: string, key: string): Promise<string> {
  const row = await db.shopSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getAllSettings(
  orgId: string,
): Promise<Record<string, string>> {
  const rows = await db.shopSetting.findMany({ where: { orgId } });
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
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
  const last = await db.repairOrder.findFirst({
    where: { orgId },
    orderBy: { roNumber: "desc" },
    select: { roNumber: true },
  });
  return (last?.roNumber ?? 1000) + 1;
}
