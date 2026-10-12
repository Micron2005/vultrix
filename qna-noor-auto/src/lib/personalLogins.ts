import { db } from "@/lib/db";

export async function limitPersonalLogins(orgId: string): Promise<void> {
  const owner = await db.user.findFirst({
    where: { orgId, role: "OWNER" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const keeper =
    owner ??
    (await db.user.findFirst({
      where: { orgId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }));

  if (!keeper) return;

  await db.user.updateMany({
    where: { orgId, id: { not: keeper.id }, isActive: true },
    data: { isActive: false },
  });
}
