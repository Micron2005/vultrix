import { db } from "./db";

const DEFAULTS: Record<string, string> = {
  shopName: "QNA / Noor Auto Repair",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  defaultLaborRate: "150",
  defaultTaxRate: "8.25",
};

export async function getSetting(key: string): Promise<string> {
  const row = await db.shopSetting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.shopSetting.findMany();
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string) {
  await db.shopSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getNextRoNumber(): Promise<number> {
  const last = await db.repairOrder.findFirst({
    orderBy: { roNumber: "desc" },
    select: { roNumber: true },
  });
  return (last?.roNumber ?? 1000) + 1;
}
