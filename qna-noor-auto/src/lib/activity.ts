import { db } from "@/lib/db";

export async function logActivity(input: {
  orgId: string;
  user: { id: string; username: string } | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        orgId: input.orgId,
        userId: input.user?.id ?? null,
        username: input.user?.username ?? "system",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
      },
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
}
