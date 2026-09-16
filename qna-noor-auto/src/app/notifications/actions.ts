"use server";

import { revalidatePath } from "next/cache";
import { deleteNotifications, markRead } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await markRead(user, "all");
  revalidatePath("/notifications");
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await markRead(user, [id]);
  revalidatePath("/notifications");
}

export async function deleteNotification(id: string) {
  const user = await requireUser();
  await deleteNotifications(user, [id]);
  revalidatePath("/notifications");
}

export async function deleteReadNotifications() {
  const user = await requireUser();
  await deleteNotifications(user, "read");
  revalidatePath("/notifications");
}

export async function deleteAllNotifications() {
  const user = await requireUser();
  await deleteNotifications(user, "all");
  revalidatePath("/notifications");
}
