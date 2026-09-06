import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";

export type NotificationKind =
  | "appointment_request"
  | "payment"
  | "deposit"
  | "estimate"
  | "goals_today"
  | "goal_behind"
  | "low_stock"
  | "task_assigned";

type NotificationUser = Pick<CurrentUser, "id" | "orgId" | "role">;

export async function notify(input: {
  orgId: string;
  userId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string;
}): Promise<void> {
  try {
    if (input.dedupeKey) {
      const existing = await db.notification.findFirst({
        where: {
          orgId: input.orgId,
          userId: input.userId ?? null,
          kind: input.kind,
          title: input.title,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
      });
      if (existing) return;
    }
    await db.notification.create({
      data: {
        orgId: input.orgId,
        userId: input.userId ?? null,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write notification:", error);
  }
}

export function notificationsWhereForUser(user: NotificationUser) {
  return {
    orgId: user.orgId!,
    OR: [
      { userId: user.id },
      ...(user.role === "OWNER" || user.role === "ADMIN"
        ? [{ userId: null }]
        : []),
    ],
  };
}

export async function listNotifications(
  user: NotificationUser,
  options: { limit?: number } = {},
) {
  if (!user.orgId) return [];
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  return db.notification.findMany({
    where: notificationsWhereForUser(user),
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function unreadCount(user: NotificationUser): Promise<number> {
  if (!user.orgId) return 0;
  return db.notification.count({
    where: {
      ...notificationsWhereForUser(user),
      readAt: null,
    },
  });
}

export async function markRead(
  user: NotificationUser,
  ids: string[] | "all",
): Promise<void> {
  if (!user.orgId) return;
  await db.notification.updateMany({
    where: {
      ...notificationsWhereForUser(user),
      readAt: null,
      ...(ids === "all" ? {} : { id: { in: ids } }),
    },
    data: { readAt: new Date() },
  });
}
